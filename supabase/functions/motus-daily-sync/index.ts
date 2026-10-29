/**
 * Daily MOTUS check.
 * Looks up every client insurance record on MOTUS and, when MOTUS has a cancellation date that is
 * not saved yet, creates a pending cancellation suggestion (same review flow as BrokerSnapshot).
 * Nothing on client_insurance is changed here; a person approves each suggestion.
 *
 * Body: { trigger?: 'cron' | 'manual', part?: number, parts?: number, client_insurance_ids?: number[] }
 * `part`/`parts` split the clients across several scheduled runs so each one finishes in time.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  calendarIso,
  cancellationDateNeedsUpdate,
  classifyMotusReport,
  isRetryableMotusFailure,
  latestCancellationIso,
  parseMotusQuery,
} from '../../../src/lib/motusInsurance.ts';
import { fetchMotusReport } from '../_shared/motusLookup.ts';

const CONCURRENCY = 3;
/** Stop starting new lookups after this long so the function can still write its results. */
const TIME_BUDGET_MS = 90_000;
/** One client's lookup can chain several slow MOTUS calls; give up on it so the run still finishes. */
const LOOKUP_TIMEOUT_MS = 40_000;
/** Save progress this often so a run that is cut off still shows how far it got. */
const PROGRESS_EVERY = 10;
/** A run still "running" after this long was killed before it could finish. */
const STALE_RUN_MS = 10 * 60_000;

interface ClientInsuranceRow {
  id: number;
  owner_id: string | null;
  client: string;
  mc: string | null;
  dot: string | null;
  status: string | null;
  expiration_date: string | null;
}

interface SyncRequestBody {
  trigger?: 'manual' | 'cron';
  part?: number;
  parts?: number;
  client_insurance_ids?: number[];
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Same query rules as the MOTUS page: the DOT if there is one, otherwise the MC docket. */
function queryForRow(row: ClientInsuranceRow): string | null {
  const dot = parseMotusQuery(row.dot ?? '');
  if (dot) return dot.kind === 'dot' ? dot.dot : `${dot.prefix}${dot.number}`;
  const mcText = (row.mc ?? '').trim();
  const digits = mcText.replace(/\D/g, '');
  const mc = parseMotusQuery(/^(MC|FF|MX)/i.test(mcText) ? mcText : digits ? `MC${digits}` : '');
  return mc?.kind === 'docket' ? `${mc.prefix}${mc.number}` : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const cronSecret = Deno.env.get('CRON_SECRET');

    let body: SyncRequestBody = {};
    if (req.method === 'POST') body = ((await req.json().catch(() => ({}))) as SyncRequestBody) ?? {};

    // Auth: cron secret header, a signed-in platform admin, or (when no secret is set) the cron trigger.
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    let source: 'cron' | 'manual' = 'cron';
    let authenticated = false;
    /** Set for a signed-in team user: only that team's clients are checked. */
    let teamOwnerIds: string[] | null = null;
    if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
      authenticated = true;
    } else if (jwt) {
      const { data } = await supabase.auth.getUser(jwt);
      const email = (data.user?.email ?? '').trim().toLowerCase();
      if (data.user) {
        authenticated = true;
        source = 'manual';
        const { data: admin } = email
          ? await supabase.from('platform_admins').select('email').eq('email', email).maybeSingle()
          : { data: null };
        if (!admin) {
          const { data: owners } = await supabase.rpc('brokersnapshot_sync_owner_ids', {
            p_triggering_user_id: data.user.id,
          });
          teamOwnerIds = (owners as string[] | null) ?? [];
        }
      }
    } else if (!cronSecret && body.trigger === 'cron') {
      authenticated = true;
    }
    if (!authenticated) return json({ error: 'Unauthorized.' }, 401);

    // Earlier runs that were killed mid-way never got to close themselves.
    await supabase
      .from('brokersnapshot_sync_runs')
      .update({
        status: 'failed',
        error_summary: 'MOTUS: run was interrupted before it finished',
        finished_at: new Date().toISOString(),
      })
      .eq('source', 'motus')
      .eq('status', 'running')
      .lt('started_at', new Date(Date.now() - STALE_RUN_MS).toISOString());

    const { data: run, error: runError } = await supabase
      .from('brokersnapshot_sync_runs')
      .insert({ status: 'running', trigger_source: source, source: 'motus' })
      .select('id')
      .single();
    if (runError || !run) return json({ error: runError?.message ?? 'Could not create sync run' }, 500);
    const runId = run.id as number;

    // Every active company's team, same scope a platform admin sync uses.
    const { data: companies } = await supabase
      .from('companies')
      .select('owner_id')
      .not('owner_id', 'is', null)
      .eq('status', 'active');
    const ownerIds =
      teamOwnerIds ??
      ([
        ...new Set(((companies ?? []) as { owner_id: string | null }[]).map((c) => c.owner_id).filter(Boolean)),
      ] as string[]);

    let rows: ClientInsuranceRow[] = [];
    if (ownerIds.length) {
      let q = supabase
        .from('client_insurance')
        .select('id, owner_id, client, mc, dot, status, expiration_date')
        .in('owner_id', ownerIds);
      if (source === 'manual' && Array.isArray(body.client_insurance_ids) && body.client_insurance_ids.length) {
        q = q.in('id', body.client_insurance_ids);
      }
      const { data, error } = await q.order('id');
      if (error) throw error;
      rows = (data ?? []) as ClientInsuranceRow[];
    }

    const parts = Math.max(1, Math.floor(body.parts ?? 1));
    const part = Math.min(parts - 1, Math.max(0, Math.floor(body.part ?? 0)));
    const work = rows.filter((_, i) => i % parts === part).filter((row) => queryForRow(row));

    const startedAt = Date.now();
    let cursor = 0;
    let checked = 0;
    let suggested = 0;
    let errors = 0;
    const messages: string[] = [];
    const hits: { client: string; cancellation_date: string }[] = [];

    const worker = async () => {
      while (Date.now() - startedAt < TIME_BUDGET_MS) {
        const row = work[cursor++];
        if (!row) return;
        const query = parseMotusQuery(queryForRow(row)!)!;
        const t0 = Date.now();
        const result: Awaited<ReturnType<typeof fetchMotusReport>> = await Promise.race([
          fetchMotusReport(query),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS)
          ),
        ]).catch(() => ({ ok: false as const, status: 0, error: 'MOTUS lookup timeout' }));
        checked++;
        if (checked % PROGRESS_EVERY === 0) {
          await supabase
            .from('brokersnapshot_sync_runs')
            .update({ clients_checked: checked, cancellations_found: suggested, errors_count: errors })
            .eq('id', runId);
        }

        if (!result.ok) {
          // A missing MOTUS account is a result, not a failure.
          if (result.status !== 404 || isRetryableMotusFailure(result.error)) {
            errors++;
            if (messages.length < 10) messages.push(`${row.client}: ${result.error}`);
          }
          await supabase.from('brokersnapshot_api_logs').insert({
            sync_run_id: runId,
            client_insurance_id: row.id,
            owner_id: row.owner_id,
            client_name: row.client,
            mc: row.mc ?? '',
            dot: row.dot ?? '',
            request_path: `motus:${query.kind === 'dot' ? query.dot : query.prefix + query.number}`,
            http_status: result.status,
            success: false,
            error_message: result.error,
            duration_ms: Date.now() - t0,
          });
          continue;
        }

        const classified = classifyMotusReport(result.report);
        const motusIso = latestCancellationIso(classified.cancellationDates);
        const status = (row.status ?? 'OK').trim();
        const needsUpdate =
          classified.verdict === 'cancellation' &&
          cancellationDateNeedsUpdate({ status, expirationDate: row.expiration_date, motusIso });

        await supabase.from('brokersnapshot_api_logs').insert({
          sync_run_id: runId,
          client_insurance_id: row.id,
          owner_id: row.owner_id,
          client_name: row.client,
          mc: row.mc ?? '',
          dot: row.dot ?? '',
          request_path: `motus:${result.report.dotNumber}`,
          http_status: 200,
          success: true,
          response_summary: { source: 'motus', verdict: classified.verdict, summary: classified.summary },
          cancellation_detected: classified.verdict === 'cancellation',
          cancellation_date: motusIso,
          duration_ms: Date.now() - t0,
        });

        if (!needsUpdate || !motusIso) continue;
        suggested++;
        hits.push({ client: row.client, cancellation_date: motusIso });

        const { data: existing } = await supabase
          .from('brokersnapshot_cancellation_suggestions')
          .select('id, source_data')
          .eq('client_insurance_id', row.id)
          .eq('review_status', 'pending')
          .eq('suggested_cancellation_date', motusIso)
          .maybeSingle();
        if (existing) {
          // Already suggested (e.g. by BrokerSnapshot): mark it as confirmed by MOTUS so it shows in Auto check.
          await supabase
            .from('brokersnapshot_cancellation_suggestions')
            .update({
              source_data: { ...((existing.source_data as Record<string, unknown> | null) ?? {}), motus_confirmed: true },
            })
            .eq('id', existing.id);
          continue;
        }

        await supabase
          .from('brokersnapshot_cancellation_suggestions')
          .update({ review_status: 'superseded' })
          .eq('client_insurance_id', row.id)
          .eq('review_status', 'pending')
          .neq('suggested_cancellation_date', motusIso);

        await supabase.from('brokersnapshot_cancellation_suggestions').insert({
          sync_run_id: runId,
          client_insurance_id: row.id,
          owner_id: row.owner_id,
          client_name: row.client,
          mc: row.mc ?? '',
          suggested_cancellation_date: calendarIso(motusIso) ?? motusIso,
          suggested_dot: result.report.dotNumber,
          source_data: {
            source: 'motus',
            reason: 'pending',
            authority_status: classified.authorityStatus,
            docket: classified.docketNumber,
            cancellation_dates: classified.cancellationDates,
            summary: classified.summary,
          },
          review_status: 'pending',
        });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const skipped = work.length - checked;
    if (skipped > 0) messages.push(`${skipped} client(s) not reached before the time limit`);
    const finalStatus = errors === 0 ? 'success' : errors < checked ? 'partial' : 'failed';
    await supabase
      .from('brokersnapshot_sync_runs')
      .update({
        status: finalStatus,
        clients_checked: checked,
        cancellations_found: suggested,
        errors_count: errors,
        error_summary: messages.length ? `MOTUS: ${messages.join('; ')}` : null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return json({
      sync_run_id: runId,
      status: finalStatus,
      part,
      parts,
      clients_in_part: work.length,
      clients_checked: checked,
      suggestions: suggested,
      errors_count: errors,
      hits,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

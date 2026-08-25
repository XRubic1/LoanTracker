/**
 * BrokerSnapshot daily sync edge function.
 * Fetches insurance data for the owner account's client_insurance rows, logs API calls,
 * and creates pending cancellation suggestions.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  BROKERSNAPSHOT_API_BASE,
  buildCompanyRequestPath,
  buildResponseSummary,
  detectCancellationSuggestion,
  detectOperatingStatusIssue,
  isBrokerSnapshotEligibleStatus,
  type BrokerSnapshotApiResponse,
  type ClientInsuranceSnapshot,
} from '../_shared/brokersnapshot.ts';

/** Delay between BrokerSnapshot company lookups (slower = gentler on API + edge CPU). */
const RATE_LIMIT_MS = 500;
const MAX_RETRIES = 1;

interface ClientInsuranceRow {
  id: number;
  owner_id: string | null;
  client: string;
  mc: string;
  dot: string | null;
  status: string;
  expiration_date: string | null;
}

interface SyncRequestBody {
  trigger?: 'manual' | 'cron';
  /** Manual test mode: only check these client_insurance ids (saves API quota). */
  client_insurance_ids?: number[];
  /** Platform admin: limit sync to these company owner UUIDs. */
  owner_ids?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };
}

async function fetchCompany(
  token: string,
  requestPath: string
): Promise<{ status: number; body: BrokerSnapshotApiResponse | null; error?: string }> {
  const url = `${BROKERSNAPSHOT_API_BASE}${requestPath}`;
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Enum-Format': 'both',
        'X-Null-Value': 'include',
      },
    });
    lastStatus = res.status;

    if (res.status === 429 && attempt < MAX_RETRIES) {
      await sleep(1000);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { status: res.status, body: null, error: text || res.statusText };
    }

    const body = (await res.json()) as BrokerSnapshotApiResponse;
    return { status: res.status, body };
  }

  return { status: lastStatus, body: null, error: 'Rate limited after retries' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiToken = Deno.env.get('BROKERSNAPSHOT_API_TOKEN');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!apiToken) {
      return new Response(JSON.stringify({ error: 'BROKERSNAPSHOT_API_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let requestBody: SyncRequestBody = {};
    if (req.method === 'POST') {
      try {
        requestBody = (await req.json()) as SyncRequestBody;
      } catch {
        // empty body
      }
    }

    // Auth: cron secret header OR logged-in user JWT (manual "Run sync now")
    const cronHeader = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    let triggerSource: 'cron' | 'manual' = 'cron';
    let authenticated = false;
    let triggeringUserId: string | null = null;
    let triggeringUserEmail: string | null = null;

    if (cronSecret && cronHeader === cronSecret) {
      authenticated = true;
      triggerSource = 'cron';
    } else if (jwt) {
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
      if (!userError && userData.user) {
        authenticated = true;
        triggerSource = 'manual';
        triggeringUserId = userData.user.id;
        triggeringUserEmail = (userData.user.email ?? '').trim().toLowerCase() || null;
      }
    } else if (!cronSecret && requestBody.trigger === 'cron') {
      // pg_cron scheduled run (set CRON_SECRET in production for stricter auth)
      authenticated = true;
      triggerSource = 'cron';
    }

    // client_insurance_ids only allowed for manual test runs (saves API quota)
    const filterClientIds =
      triggerSource === 'manual' &&
      Array.isArray(requestBody.client_insurance_ids) &&
      requestBody.client_insurance_ids.length > 0
        ? requestBody.client_insurance_ids.filter((id) => Number.isFinite(id) && id > 0)
        : null;

    if (!authenticated) {
      const hint = cronSecret
        ? 'Sign in and try again, or invoke with x-cron-secret header for scheduled runs.'
        : 'Sign in to the app and try again.';
      return new Response(JSON.stringify({ error: `Unauthorized. ${hint}` }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Create sync run
    const { data: runRow, error: runError } = await supabase
      .from('brokersnapshot_sync_runs')
      .insert({ status: 'running', trigger_source: triggerSource })
      .select('id')
      .single();

    if (runError || !runRow) {
      return new Response(JSON.stringify({ error: runError?.message ?? 'Failed to create sync run' }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const syncRunId = runRow.id as number;
    let clientsChecked = 0;
    let cancellationsFound = 0;
    let outOfServiceFound = 0;
    let errorsCount = 0;
    const errorMessages: string[] = [];
    const cancellationHits: {
      client_insurance_id: number;
      client: string;
      mc: string;
      cancellation_date: string | null;
    }[] = [];
    const outOfServiceHits: {
      client_insurance_id: number;
      client: string;
      mc: string;
      operating_status: string;
      app_status: string;
      status_updated: boolean;
    }[] = [];

    // One team per run for normal users; platform admins sync all provisioned companies.
    // Cron uses BROKERSNAPSHOT_CRON_OWNER_ID when set.
    let syncOwnerIds: string[] = [];

    if (triggerSource === 'manual' && triggeringUserId) {
      let isPlatformAdmin = false;
      if (triggeringUserEmail) {
        const { data: adminRow } = await supabase
          .from('platform_admins')
          .select('email')
          .eq('email', triggeringUserEmail)
          .maybeSingle();
        isPlatformAdmin = Boolean(adminRow);
      }

      if (isPlatformAdmin) {
        const bodyOwnerIds = Array.isArray(requestBody.owner_ids)
          ? requestBody.owner_ids.filter((id) => typeof id === 'string' && id.length > 0)
          : [];

        if (bodyOwnerIds.length > 0) {
          syncOwnerIds = [...new Set(bodyOwnerIds)];
        } else {
          const { data: companies } = await supabase
            .from('companies')
            .select('owner_id')
            .not('owner_id', 'is', null)
            .eq('status', 'active');
          syncOwnerIds = [
            ...new Set(
              ((companies ?? []) as { owner_id: string | null }[])
                .map((c) => c.owner_id)
                .filter((id): id is string => Boolean(id))
            ),
          ];
        }
      } else {
        const { data: syncOwnerRows, error: ownerIdsError } = await supabase.rpc(
          'brokersnapshot_sync_owner_ids',
          { p_triggering_user_id: triggeringUserId }
        );
        if (ownerIdsError) {
          await supabase
            .from('brokersnapshot_sync_runs')
            .update({
              status: 'failed',
              finished_at: new Date().toISOString(),
              error_summary: ownerIdsError.message,
            })
            .eq('id', syncRunId);
          return new Response(JSON.stringify({ error: ownerIdsError.message }), {
            status: 500,
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
          });
        }
        syncOwnerIds = (syncOwnerRows as string[] | null) ?? [];
      }
    } else {
      const scopeOwnerId = Deno.env.get('BROKERSNAPSHOT_CRON_OWNER_ID')?.trim() || null;
      const { data: syncOwnerRows, error: ownerIdsError } = await supabase.rpc(
        'brokersnapshot_sync_owner_ids',
        { p_triggering_user_id: scopeOwnerId }
      );
      if (ownerIdsError) {
        await supabase
          .from('brokersnapshot_sync_runs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_summary: ownerIdsError.message,
          })
          .eq('id', syncRunId);
        return new Response(JSON.stringify({ error: ownerIdsError.message }), {
          status: 500,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
      syncOwnerIds = (syncOwnerRows as string[] | null) ?? [];
    }

    if (syncOwnerIds.length === 0) {
      const scopeHint =
        triggerSource === 'manual'
          ? 'Could not resolve your team owner for sync. Platform admins need active companies with team admins.'
          : 'Set BROKERSNAPSHOT_CRON_OWNER_ID in Edge Function secrets (team owner UUID).';
      await supabase
        .from('brokersnapshot_sync_runs')
        .update({
          status: 'success',
          clients_checked: 0,
          cancellations_found: 0,
          errors_count: 0,
          error_summary: scopeHint,
          finished_at: new Date().toISOString(),
        })
        .eq('id', syncRunId);
      return new Response(
        JSON.stringify({
          sync_run_id: syncRunId,
          status: 'success',
          clients_checked: 0,
          cancellations_found: 0,
          errors_count: 0,
          message: scopeHint,
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    let clientsQuery = supabase
      .from('client_insurance')
      .select('id, owner_id, client, mc, dot, status, expiration_date')
      .in('owner_id', syncOwnerIds)
      .not('mc', 'is', null)
      .neq('mc', '');

    if (filterClientIds && filterClientIds.length > 0) {
      clientsQuery = clientsQuery.in('id', filterClientIds);
    }

    const { data: clients, error: clientsError } = await clientsQuery.order('id');

    if (clientsError) {
      await supabase
        .from('brokersnapshot_sync_runs')
        .update({ status: 'failed', finished_at: new Date().toISOString(), error_summary: clientsError.message })
        .eq('id', syncRunId);
      return new Response(JSON.stringify({ error: clientsError.message }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const records = ((clients ?? []) as ClientInsuranceRow[]).filter((row) =>
      isBrokerSnapshotEligibleStatus(row.status)
    );

    for (const row of records) {
      const snapshot: ClientInsuranceSnapshot = {
        id: row.id,
        client: row.client,
        mc: row.mc,
        dot: row.dot?.trim() ?? '',
        status: row.status ?? 'OK',
        expiration_date: row.expiration_date,
      };

      const requestPath = buildCompanyRequestPath(row.mc);
      const startMs = Date.now();

      if (!requestPath) {
        errorsCount++;
        errorMessages.push(`${row.client}: unparseable MC "${row.mc}"`);
        await supabase.from('brokersnapshot_api_logs').insert({
          sync_run_id: syncRunId,
          client_insurance_id: row.id,
          owner_id: row.owner_id,
          client_name: row.client,
          mc: row.mc,
          dot: row.dot ?? '',
          request_path: null,
          http_status: null,
          success: false,
          error_message: 'Unparseable MC number',
          duration_ms: Date.now() - startMs,
        });
        clientsChecked++;
        continue;
      }

      const { status, body, error } = await fetchCompany(apiToken, requestPath);
      const durationMs = Date.now() - startMs;
      const success = status === 200 && body?.Success === true;
      const responseSummary = success ? buildResponseSummary(body?.Data) : undefined;
      const detected = success ? detectCancellationSuggestion(snapshot, body?.Data) : null;
      const oosIssue = success ? detectOperatingStatusIssue(snapshot, body?.Data) : null;

      await supabase.from('brokersnapshot_api_logs').insert({
        sync_run_id: syncRunId,
        client_insurance_id: row.id,
        owner_id: row.owner_id,
        client_name: row.client,
        mc: row.mc,
        dot: row.dot ?? '',
        request_path: requestPath,
        http_status: status,
        success,
        error_message: error ?? (success ? null : body?.Message ?? 'API returned Success=false'),
        response_summary: responseSummary ?? null,
        cancellation_detected: responseSummary?.has_pending_cancellation === true,
        cancellation_date:
          responseSummary?.pending_cancellation_date ??
          detected?.suggested_cancellation_date ??
          null,
        duration_ms: durationMs,
      });

      if (!success) {
        errorsCount++;
        if (errorMessages.length < 10) {
          errorMessages.push(`${row.client}: HTTP ${status} ${error ?? body?.Message ?? ''}`);
        }
      }

      if (responseSummary?.has_pending_cancellation) {
        cancellationsFound++;
        cancellationHits.push({
          client_insurance_id: row.id,
          client: row.client,
          mc: row.mc,
          cancellation_date:
            responseSummary.pending_cancellation_date ??
            detected?.suggested_cancellation_date ??
            null,
        });
      }

      if (detected) {
        // Check for duplicate pending suggestion
        const { data: existing } = await supabase
          .from('brokersnapshot_cancellation_suggestions')
          .select('id')
          .eq('client_insurance_id', row.id)
          .eq('review_status', 'pending')
          .eq('suggested_cancellation_date', detected.suggested_cancellation_date)
          .maybeSingle();

        if (!existing) {
          // Supersede older pending suggestions with different dates
          await supabase
            .from('brokersnapshot_cancellation_suggestions')
            .update({ review_status: 'superseded' })
            .eq('client_insurance_id', row.id)
            .eq('review_status', 'pending')
            .neq('suggested_cancellation_date', detected.suggested_cancellation_date);

          await supabase.from('brokersnapshot_cancellation_suggestions').insert({
            sync_run_id: syncRunId,
            client_insurance_id: row.id,
            owner_id: row.owner_id,
            client_name: row.client,
            mc: row.mc,
            suggested_cancellation_date: detected.suggested_cancellation_date,
            suggested_dot: detected.suggested_dot ?? null,
            policy_number: detected.policy_number ?? null,
            insurance_company: detected.insurance_company ?? null,
            source_data: detected.source_data,
            review_status: 'pending',
          });
        }
      }

      // Apply CURRENT insurance coverage updates only (never Authority OOS / Not Authorized).
      // Also fill missing DOT from the live Company payload.
      const insurancePatch: Record<string, unknown> = {
        brokersnapshot_last_checked_at: new Date().toISOString(),
      };
      let statusUpdated = false;
      if (
        success &&
        responseSummary?.dot_number &&
        !(row.dot ?? '').trim()
      ) {
        insurancePatch.dot = String(responseSummary.dot_number);
      }
      if (oosIssue) {
        const currentStatus = (row.status ?? '').trim().toLowerCase();
        if (currentStatus !== oosIssue.app_status.toLowerCase()) {
          insurancePatch.status = oosIssue.app_status;
          statusUpdated = true;
        }
        if (oosIssue.suggested_dot) {
          insurancePatch.dot = oosIssue.suggested_dot;
        }
        outOfServiceFound++;
        outOfServiceHits.push({
          client_insurance_id: row.id,
          client: row.client,
          mc: row.mc,
          operating_status:
            oosIssue.reason === 'active_insurance'
              ? `Active insurance (${oosIssue.active_policy_count}) — restored OK`
              : oosIssue.operating_status ?? oosIssue.reason,
          app_status: oosIssue.app_status,
          status_updated: statusUpdated || Boolean(oosIssue.suggested_dot),
        });
      }
      await supabase.from('client_insurance').update(insurancePatch).eq('id', row.id);

      clientsChecked++;
      await sleep(RATE_LIMIT_MS);
    }

    const finalStatus =
      errorsCount === 0 ? 'success' : errorsCount < clientsChecked ? 'partial' : 'failed';

    await supabase
      .from('brokersnapshot_sync_runs')
      .update({
        status: finalStatus,
        clients_checked: clientsChecked,
        cancellations_found: cancellationsFound,
        errors_count: errorsCount,
        error_summary: errorMessages.length > 0 ? errorMessages.join('; ') : null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', syncRunId);

    return new Response(
      JSON.stringify({
        sync_run_id: syncRunId,
        status: finalStatus,
        clients_checked: clientsChecked,
        cancellations_found: cancellationsFound,
        out_of_service_found: outOfServiceFound,
        errors_count: errorsCount,
        cancellation_hits: cancellationHits,
        out_of_service_hits: outOfServiceHits,
      }),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});

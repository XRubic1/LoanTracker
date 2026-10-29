import { useMemo, useState } from 'react';
import type { ClientInsurance } from '@/types';
import { Badge } from '@/components/Badge';
import { Section } from '@/components/Section';
import { approveCancellationSuggestion, rejectCancellationSuggestion } from '@/lib/supabase-db';
import {
  actionableInactive,
  pendingRenewals,
  runMotusAutoCheckNow,
  type MotusAutoCheckData,
  type MotusRun,
} from '@/lib/motusAutoCheck';
import { ConfirmRenewedButton, type SaveInsurance } from '@/components/InsuranceRenewalActions';
import { fmtDateTime } from '@/lib/utils';

interface MotusAutoCheckTabProps {
  userId: string;
  data: MotusAutoCheckData;
  loading: boolean;
  error: string | null;
  clientInsurance: ClientInsurance[];
  onReload: () => Promise<void>;
  onRefreshInsurance?: () => void;
  onUpdateInsurance?: SaveInsurance;
}

function displayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

interface DaySummary {
  day: string;
  runs: MotusRun[];
  checked: number;
  issues: number;
  errors: number;
  status: MotusRun['status'];
}

/** The scheduled check runs in several parts; show each day as one line. */
function summarizeDays(runs: MotusRun[]): DaySummary[] {
  const byDay = new Map<string, MotusRun[]>();
  for (const run of runs) {
    const day = new Date(run.started_at).toLocaleDateString('en-US');
    byDay.set(day, [...(byDay.get(day) ?? []), run]);
  }
  return [...byDay.entries()].map(([day, list]) => {
    const running = list.some((r) => r.status === 'running');
    const allFailed = list.every((r) => r.status === 'failed');
    const someErrors = list.some((r) => r.status === 'partial' || r.status === 'failed');
    return {
      day,
      runs: list,
      checked: list.reduce((n, r) => n + r.clients_checked, 0),
      issues: list.reduce((n, r) => n + r.cancellations_found, 0),
      errors: list.reduce((n, r) => n + r.errors_count, 0),
      status: running ? 'running' : allFailed ? 'failed' : someErrors ? 'partial' : 'success',
    };
  });
}

function statusBadge(status: MotusRun['status']) {
  if (status === 'success') return <Badge variant="ok">OK</Badge>;
  if (status === 'running') return <Badge variant="due">Running</Badge>;
  if (status === 'partial') return <Badge variant="due">Some errors</Badge>;
  return <Badge variant="overdue">Failed</Badge>;
}

export function MotusAutoCheckTab({
  userId,
  data,
  loading,
  error,
  clientInsurance,
  onReload,
  onRefreshInsurance,
  onUpdateInsurance,
}: MotusAutoCheckTabProps) {
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const days = useMemo(() => summarizeDays(data.runs), [data.runs]);
  const latest = days[0] ?? null;
  const inactive = useMemo(
    () => actionableInactive(data.inactive, clientInsurance),
    [data.inactive, clientInsurance]
  );
  const renewals = useMemo(() => pendingRenewals(data, clientInsurance), [data, clientInsurance]);
  const onFile = (id: number) => clientInsurance.find((c) => c.id === id);
  const issueCount = data.suggestions.length + inactive.length + renewals.length;

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const result = await runMotusAutoCheckNow();
      setMessage(
        `Checked ${result.checked} clients · ${result.suggestions} new cancellation${result.suggestions === 1 ? '' : 's'} found` +
          (result.errors ? ` · ${result.errors} lookup error${result.errors === 1 ? '' : 's'}` : '')
      );
      await onReload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not run the check');
    } finally {
      setRunning(false);
    }
  }

  async function decide(id: number, action: 'approve' | 'dismiss') {
    setBusyId(id);
    try {
      if (action === 'approve') {
        await approveCancellationSuggestion(id, userId);
        onRefreshInsurance?.();
      } else {
        await rejectCancellationSuggestion(id, userId);
      }
      await onReload();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">Automatic MOTUS check</h2>
            <p className="mt-1 text-sm text-muted">
              Every client is checked on MOTUS each morning (about 6:00 AM Eastern). New cancellation dates and
              inactive authorities show up below, and a notice appears at the top of the app.
            </p>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={() => void runNow()}
            className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {running ? 'Checking…' : 'Run check now'}
          </button>
        </div>

        {running ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" role="status" aria-label="Checking">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-label">Last run</dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {latest ? fmtDateTime(latest.runs[0].started_at) : loading ? 'Loading…' : 'Not run yet'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-label">Result</dt>
            <dd className="mt-1">
              {latest ? statusBadge(latest.status) : <span className="text-sm text-muted">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-label">Clients checked</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{latest ? latest.checked : '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-label">Open issues</dt>
            <dd className={`mt-1 text-sm font-medium ${issueCount > 0 ? 'text-red' : 'text-ink'}`}>{issueCount}</dd>
          </div>
        </dl>
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
      </section>

      <Section title="New cancellations found" count={data.suggestions.length} noPadding>
        {data.suggestions.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted">
            Nothing new. Every cancellation date MOTUS shows is already on file.
          </div>
        ) : (
          data.suggestions.map((s) => {
            const record = onFile(s.client_insurance_id);
            const current = record && /cancel/i.test(record.status) ? displayDate(record.expiration_date) : 'None';
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{s.client_name ?? record?.client ?? '—'}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {s.suggested_dot ? `DOT ${s.suggested_dot} · ` : ''}Found {fmtDateTime(s.created_at)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>
                    On file: <span className="text-ink">{current}</span>
                  </div>
                  <div>
                    MOTUS: <span className="font-medium text-red">{displayDate(s.suggested_cancellation_date)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void decide(s.id, 'approve')}
                    className="rounded-lg btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    Update to {displayDate(s.suggested_cancellation_date)}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void decide(s.id, 'dismiss')}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Section>

      <Section title="Cancellation gone on MOTUS" count={renewals.length} noPadding>
        {renewals.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted">
            No client with a cancellation on file shows active insurance on MOTUS.
          </div>
        ) : (
          renewals.map((record) => (
            <div key={record.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{record.client}</div>
                <div className="mt-0.5 text-xs text-muted">
                  MOTUS shows active insurance with no cancellation. On file: cancellation{' '}
                  {displayDate(record.expiration_date)}
                </div>
              </div>
              {onUpdateInsurance && <ConfirmRenewedButton record={record} onSave={onUpdateInsurance} />}
            </div>
          ))
        )}
      </Section>

      <Section title="Inactive on MOTUS" count={inactive.length} noPadding>
        {inactive.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted">
            No client marked OK in the app is inactive or missing insurance on MOTUS.
          </div>
        ) : (
          inactive.map((finding) => (
            <div
              key={`${finding.client_insurance_id}-${finding.checked_at}`}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{finding.client_name}</div>
                <div className="mt-0.5 text-xs text-muted">{finding.summary}</div>
              </div>
              <span className="font-mono text-xs text-muted">{finding.dot ? `DOT ${finding.dot}` : ''}</span>
              <Badge variant="overdue">App says OK</Badge>
            </div>
          ))
        )}
      </Section>

      <Section title="Run history" count={days.length} noPadding>
        {days.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted">No runs yet.</div>
        ) : (
          <table className="w-full border-collapse text-left text-sm" data-no-sort>
            <thead>
              <tr>
                {['Date', 'Result', 'Checked', 'New cancellations', 'Errors'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2 text-[10px] font-normal uppercase tracking-widest text-label"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-b border-divider last:border-b-0">
                  <td className="px-4 py-2 text-ink">{d.day}</td>
                  <td className="px-4 py-2">{statusBadge(d.status)}</td>
                  <td className="px-4 py-2">{d.checked}</td>
                  <td className="px-4 py-2">{d.issues}</td>
                  <td className="px-4 py-2">{d.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

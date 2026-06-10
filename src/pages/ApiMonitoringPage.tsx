import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveAllCancellationSuggestions,
  BROKERSNAPSHOT_BULK_ERROR_DATE,
  clearBrokerSnapshotMonitoringData,
  countBulkCancellationReverts,
  fetchBrokerSnapshotApiLogs,
  fetchBrokerSnapshotSyncRuns,
  fetchPendingCancellationSuggestions,
  revertBulkIncorrectCancellations,
  triggerBrokerSnapshotSync,
} from '@/lib/supabase-db';
import { isBrokerSnapshotSyncClient } from '@/lib/brokersnapshot';
import { fmtDateTime, getWeekBoundsDateOnly } from '@/lib/utils';
import type {
  BrokerSnapshotApiLog,
  BrokerSnapshotCancellationSuggestion,
  BrokerSnapshotSyncRun,
  ClientInsurance,
} from '@/types';

interface ApiMonitoringPageProps {
  userId: string;
  effectiveOwnerId: string;
  clientInsurance: ClientInsurance[];
  onRefreshInsurance?: () => void;
}

type MainTab = 'pending' | 'checked';

function statusTone(status: string): string {
  switch (status) {
    case 'success':
      return 'text-emerald-600 bg-emerald-500/10';
    case 'partial':
      return 'text-amber-600 bg-amber-500/10';
    case 'failed':
      return 'text-red-600 bg-red-500/10';
    case 'running':
      return 'text-blue-600 bg-blue-500/10';
    default:
      return 'text-muted bg-surface2';
  }
}

function pendingDateFromLog(log: BrokerSnapshotApiLog): string | null {
  return (
    log.cancellation_date ??
    (typeof log.response_summary?.pending_cancellation_date === 'string'
      ? log.response_summary.pending_cancellation_date
      : null)
  );
}

export function ApiMonitoringPage({
  userId,
  effectiveOwnerId,
  clientInsurance,
  onRefreshInsurance,
}: ApiMonitoringPageProps) {
  const week = getWeekBoundsDateOnly();
  const [lastRun, setLastRun] = useState<BrokerSnapshotSyncRun | null>(null);
  const [lastRunLogs, setLastRunLogs] = useState<BrokerSnapshotApiLog[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<BrokerSnapshotCancellationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('pending');

  const bulkRevertCount = useMemo(
    () => countBulkCancellationReverts(clientInsurance, effectiveOwnerId),
    [clientInsurance, effectiveOwnerId]
  );

  const syncableClients = useMemo(
    () =>
      clientInsurance
        .filter((c) => isBrokerSnapshotSyncClient(c, effectiveOwnerId))
        .sort((a, b) => a.client.localeCompare(b.client)),
    [clientInsurance, effectiveOwnerId]
  );

  const ownerLogs = useMemo(
    () => lastRunLogs.filter((log) => !log.owner_id || log.owner_id === effectiveOwnerId),
    [lastRunLogs, effectiveOwnerId]
  );

  const isAlreadyInInsurance = useCallback(
    (log: BrokerSnapshotApiLog) => {
      const date = pendingDateFromLog(log);
      return clientInsurance.some(
        (c) =>
          c.id === log.client_insurance_id &&
          (c.status ?? '').toLowerCase().includes('cancellation') &&
          c.expiration_date === date
      );
    },
    [clientInsurance]
  );

  const pendingLogs = useMemo(
    () => ownerLogs.filter((log) => log.cancellation_detected && !isAlreadyInInsurance(log)),
    [ownerLogs, isAlreadyInInsurance]
  );

  const approvableSuggestions = useMemo(
    () =>
      pendingSuggestions.filter(
        (s) =>
          s.source_data?.reason !== 'lapsed' &&
          s.source_data?.already_in_insurance !== true
      ),
    [pendingSuggestions]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [runs, pending] = await Promise.all([
        fetchBrokerSnapshotSyncRuns(week.start, week.end),
        fetchPendingCancellationSuggestions(effectiveOwnerId),
      ]);
      const run = runs[0] ?? null;
      setLastRun(run);
      setPendingSuggestions(pending);

      if (run) {
        const logs = await fetchBrokerSnapshotApiLogs({ syncRunId: run.id });
        setLastRunLogs(logs);
      } else {
        setLastRunLogs([]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [effectiveOwnerId, week.start, week.end]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runSync = useCallback(
    async (clientInsuranceIds?: number[]) => {
      setSyncing(true);
      try {
        await triggerBrokerSnapshotSync(clientInsuranceIds?.length ? { clientInsuranceIds } : {});
        await loadData();
        onRefreshInsurance?.();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : String(err));
      } finally {
        setSyncing(false);
      }
    },
    [loadData, onRefreshInsurance]
  );

  const handleRunSync = useCallback(async () => {
    const ids = Array.from(selectedClientIds);
    if (showClientPicker) {
      if (ids.length === 0) {
        window.alert('Select at least one client.');
        return;
      }
      if (!window.confirm(`Sync ${ids.length} selected client(s)?`)) return;
      await runSync(ids);
      return;
    }
    if (!window.confirm(`Sync all ${syncableClients.length} active clients with MC numbers?`)) return;
    await runSync();
  }, [runSync, selectedClientIds, showClientPicker, syncableClients.length]);

  const handleApproveAll = useCallback(async () => {
    if (pendingLogs.length === 0 && approvableSuggestions.length === 0) return;
    const count = pendingLogs.length + approvableSuggestions.length;
    if (
      !window.confirm(
        `Approve ${count} FMCSA pending cancellation(s) and update Client Insurance? (Skips clients already recorded.)`
      )
    ) {
      return;
    }
    setApprovingAll(true);
    try {
      const { approved, failed, skipped } = await approveAllCancellationSuggestions(
        effectiveOwnerId,
        userId,
        pendingLogs
      );
      if (failed > 0 || skipped > 0) {
        window.alert(
          `Approved ${approved}.${failed > 0 ? ` ${failed} failed.` : ''}${skipped > 0 ? ` ${skipped} skipped (already recorded or lapsed).` : ''}`
        );
      }
      await loadData();
      onRefreshInsurance?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setApprovingAll(false);
    }
  }, [
    effectiveOwnerId,
    loadData,
    onRefreshInsurance,
    pendingLogs,
    approvableSuggestions.length,
    userId,
  ]);

  const handleRevertBulkErrors = useCallback(async () => {
    if (bulkRevertCount === 0) return;
    const displayDate = new Date(BROKERSNAPSHOT_BULK_ERROR_DATE + 'T12:00:00').toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }
    );
    if (
      !window.confirm(
        `Revert ${bulkRevertCount} client(s) wrongly set to Cancellation ${displayDate}? They will be set back to OK. Real cancellations on other dates are not changed.`
      )
    ) {
      return;
    }
    setReverting(true);
    try {
      const { reverted_count } = await revertBulkIncorrectCancellations(effectiveOwnerId);
      window.alert(`Reverted ${reverted_count} client(s) to OK.`);
      await loadData();
      onRefreshInsurance?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setReverting(false);
    }
  }, [bulkRevertCount, effectiveOwnerId, loadData, onRefreshInsurance]);

  const handleClearData = useCallback(async () => {
    if (
      !window.confirm(
        'Clear all BrokerSnapshot logs, sync history, and pending suggestions for your team? This cannot be undone.'
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearBrokerSnapshotMonitoringData(effectiveOwnerId);
      await loadData();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  }, [effectiveOwnerId, loadData]);

  const toggleClient = (id: number) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const syncLabel = syncing
    ? 'Syncing…'
    : showClientPicker
      ? `Sync selected (${selectedClientIds.size})`
      : `Sync all (${syncableClients.length})`;

  const canApprove = pendingLogs.length > 0 || approvableSuggestions.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden -my-4">
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <h1 className="page-title">Insurance API</h1>
          <p className="text-xs text-muted mt-0.5">
            BrokerSnapshot · your team only · Mondays 06:00 UTC
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bulkRevertCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary text-xs border-amber-500/40 text-amber-700 dark:text-amber-400"
              onClick={() => void handleRevertBulkErrors()}
              disabled={reverting || syncing || approvingAll || clearing}
            >
              {reverting ? 'Reverting…' : `Revert bulk errors (${bulkRevertCount})`}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={() => void handleClearData()}
            disabled={clearing || syncing || approvingAll || reverting}
          >
            {clearing ? 'Clearing…' : 'Clear data'}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={() => setShowClientPicker((v) => !v)}
            disabled={syncing || reverting}
          >
            {showClientPicker ? 'Hide picker' : 'Pick clients'}
          </button>
          <button
            type="button"
            className="btn btn-primary text-xs active:scale-[0.98] transition-transform"
            onClick={() => void handleRunSync()}
            disabled={syncing || syncableClients.length === 0 || reverting}
          >
            {syncLabel}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="flex-shrink-0 mt-2 p-2.5 rounded-lg bg-red-500/10 text-red-600 text-xs">{loadError}</div>
      )}

      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
        {[
          { label: 'Pending', value: pendingLogs.length, accent: 'text-amber-600' },
          { label: 'Clients', value: syncableClients.length, accent: 'text-ink' },
          {
            label: 'Last sync',
            value: lastRun ? fmtDateTime(lastRun.started_at).replace(',', '') : '—',
            accent: 'text-ink text-xs',
          },
          {
            label: 'Status',
            value: lastRun?.status ?? '—',
            accent: lastRun ? statusTone(lastRun.status).split(' ')[0] : 'text-muted',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border/70 bg-panel/80 px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted">{stat.label}</div>
            <div className={`font-semibold mt-0.5 truncate ${stat.accent}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-3">
        <section className="flex flex-col min-h-0 rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
          <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface2/30">
            <div className="filter-group">
              <button
                type="button"
                className={activeTab === 'pending' ? 'filter-btn filter-btn-active' : 'filter-btn'}
                onClick={() => setActiveTab('pending')}
              >
                Pending ({pendingLogs.length})
              </button>
              <button
                type="button"
                className={activeTab === 'checked' ? 'filter-btn filter-btn-active' : 'filter-btn'}
                onClick={() => setActiveTab('checked')}
              >
                Checked clients ({ownerLogs.length})
              </button>
            </div>
            {activeTab === 'pending' && (
              <button
                type="button"
                className="btn btn-primary px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                onClick={() => void handleApproveAll()}
                disabled={approvingAll || !canApprove || loading}
              >
                {approvingAll ? 'Approving…' : 'Approve all'}
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-sm text-muted text-center">Loading…</p>
            ) : activeTab === 'pending' ? (
              pendingLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <span className="text-emerald-600 text-xl">✓</span>
                  </div>
                  <p className="text-sm font-medium text-ink">Nothing pending</p>
                  <p className="text-xs text-muted mt-1 max-w-xs">
                    Run sync to check your clients. Pending cancellations from the last run appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {pendingLogs.map((log) => {
                    const date = pendingDateFromLog(log);
                    return (
                      <li
                        key={log.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-surface2/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{log.client_name ?? '—'}</div>
                          <div className="text-[11px] text-muted font-mono mt-0.5">MC {log.mc ?? '—'}</div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-sm font-semibold text-amber-600">{date ?? '—'}</div>
                          <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">
                            effective
                          </div>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded">
                          New
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : ownerLogs.length === 0 ? (
              <p className="p-6 text-sm text-muted text-center">Run sync to see checked clients.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-panel border-b border-border">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-2 px-4">Client</th>
                    <th className="py-2 px-2">MC</th>
                    <th className="py-2 px-2">API</th>
                    <th className="py-2 px-4">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ownerLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface2/30 transition-colors">
                      <td className="py-2.5 px-4 font-medium truncate max-w-[200px]">
                        {log.client_name ?? '—'}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-xs text-muted">{log.mc ?? '—'}</td>
                      <td className="py-2.5 px-2 text-xs">
                        {log.success ? (
                          <span className="text-emerald-600">OK</span>
                        ) : (
                          <span className="text-red-600" title={log.error_message ?? undefined}>
                            Err
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {log.cancellation_detected ? (
                          <span className="text-amber-600 font-medium">
                            {pendingDateFromLog(log) ?? 'Yes'}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="flex flex-col min-h-0 gap-3">
          {showClientPicker ? (
            <section className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
              <div className="flex-shrink-0 px-3 py-2 border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted">
                Select clients
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
                {syncableClients.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-surface2/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClientIds.has(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="rounded border-border"
                    />
                    <span className="truncate font-medium">{c.client}</span>
                  </label>
                ))}
              </div>
              <div className="flex-shrink-0 flex gap-2 px-2 py-2 border-t border-border text-[10px]">
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => setSelectedClientIds(new Set(syncableClients.map((c) => c.id)))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="text-muted hover:underline"
                  onClick={() => setSelectedClientIds(new Set())}
                >
                  None
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-panel shadow-sm p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted mb-3">Last run</h3>
              {lastRun ? (
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Checked</dt>
                    <dd className="font-medium">{lastRun.clients_checked}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Pending found</dt>
                    <dd className="font-medium text-amber-600">{lastRun.cancellations_found}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Errors</dt>
                    <dd className={`font-medium ${lastRun.errors_count ? 'text-red-600' : ''}`}>
                      {lastRun.errors_count}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <dt className="text-muted">Result</dt>
                    <dd>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase ${statusTone(lastRun.status)}`}
                      >
                        {lastRun.status}
                      </span>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-muted">No sync runs yet this week.</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

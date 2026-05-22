import { useMemo } from 'react';
import { StatCard } from '@/components/StatCard';
import {
  ActivityChart,
  activityByDateChart,
  batchesByUserChart,
  topClientsChart,
  verificationByUserChart,
} from '@/components/userActivity/ActivityChart';
import type { UserActivityAnalytics } from '@/lib/userActivityStats';

interface UserActivityOverviewProps {
  analytics: UserActivityAnalytics;
  hasEntries: boolean;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Charts, summary stats, and per-user workload cards. */
export function UserActivityOverview({ analytics, hasEntries }: UserActivityOverviewProps) {
  const { summary, byUser, byClient, byDate } = analytics;

  const batchesChart = useMemo(
    () =>
      batchesByUserChart(
        byUser.map((u) => u.label),
        byUser.map((u) => u.batches),
        byUser.map((u) => u.invoices)
      ),
    [byUser]
  );

  const dateChart = useMemo(
    () =>
      activityByDateChart(
        byDate.map((d) => formatShortDate(d.date)),
        byDate.map((d) => d.batches)
      ),
    [byDate]
  );

  const clientsChart = useMemo(
    () =>
      topClientsChart(
        byClient.map((c) => c.name),
        byClient.map((c) => c.batches)
      ),
    [byClient]
  );

  const verifyChart = useMemo(
    () =>
      verificationByUserChart(
        byUser.map((u) => u.label),
        byUser.map((u) => u.verified),
        byUser.map((u) => u.unverified)
      ),
    [byUser]
  );

  const verifiedPct =
    summary.totalBatches > 0
      ? Math.round((summary.verifiedCount / summary.totalBatches) * 100)
      : 0;

  if (!hasEntries) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-panel px-4 py-10 text-center">
        <p className="text-[13px] text-muted2">No worksheet activity in this date range.</p>
        <p className="text-[12px] text-muted mt-1">Adjust filters or check back when batches are logged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Batches" value={summary.totalBatches} sub="logged in range" />
        <StatCard label="Invoices" value={summary.totalInvoices} sub="total count" accent />
        <StatCard label="Team members" value={summary.activeUsers} sub="with activity" />
        <StatCard
          label="Verified"
          value={`${verifiedPct}%`}
          sub={`${summary.verifiedCount} of ${summary.totalBatches}`}
          valueClassName="text-green"
        />
        <StatCard
          label="Not verified"
          value={summary.unverifiedCount}
          sub="needs attention"
          valueClassName={summary.unverifiedCount > 0 ? 'text-accent' : 'text-ink'}
        />
        <StatCard
          label="Not on list"
          value={summary.unknownClientCount}
          sub="unknown clients"
          valueClassName={summary.unknownClientCount > 0 ? 'text-accent' : 'text-ink'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityChart title="Batches & invoices by user" config={batchesChart} height={240} />
        <ActivityChart title="Activity by day" config={dateChart} height={240} />
        <ActivityChart title="Top clients (batches)" config={clientsChart} height={Math.max(200, byClient.length * 28)} />
        <ActivityChart title="Verification by user" config={verifyChart} height={240} />
      </div>

      <div className="panel-surface">
        <div className="px-4 py-[11px] border-b border-border">
          <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
            Who worked on what
          </span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {byUser.map((u) => (
            <div
              key={u.userId}
              className="rounded-lg border border-border bg-surface/50 px-3 py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-ink truncate">{u.label}</p>
                <span className="text-[11px] text-muted2 whitespace-nowrap">
                  {u.batches} batch{u.batches !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="py-0.5 px-2 rounded-full bg-accent/10 text-accent">
                  {u.invoices} invoices
                </span>
                {u.unverified > 0 && (
                  <span className="py-0.5 px-2 rounded-full bg-red/10 text-red">
                    {u.unverified} unverified
                  </span>
                )}
                {u.groupWork > 0 && (
                  <span className="py-0.5 px-2 rounded-full bg-surface border border-border text-muted2">
                    {u.groupWork} group
                  </span>
                )}
              </div>
              {u.topClients.length > 0 ? (
                <ul className="text-[12px] text-muted2 space-y-1 pt-1 border-t border-divider">
                  {u.topClients.map((c) => (
                    <li key={c.name} className="flex justify-between gap-2">
                      <span className="text-ink truncate">{c.name}</span>
                      <span className="flex-shrink-0">{c.batches}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted2 pt-1">No client breakdown</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

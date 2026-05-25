import { useMemo } from 'react';
import { StatCard } from '@/components/StatCard';
import { ClientHandoffPanel } from '@/components/userActivity/ClientHandoffPanel';
import { DailyActivityGrid } from '@/components/userActivity/DailyActivityGrid';
import { TeamCoveragePanel } from '@/components/userActivity/TeamCoveragePanel';
import {
  ActivityChart,
  activityByDateChart,
  teamWorkloadChart,
} from '@/components/userActivity/ActivityChart';
import type { UserActivityAnalytics } from '@/lib/userActivityStats';
import { WORK_DURATION_MARGIN_MINUTES, WORK_MINUTES_PER_INVOICE } from '@/lib/worksheetTiming';

interface UserActivityOverviewProps {
  analytics: UserActivityAnalytics;
  hasEntries: boolean;
  onSelectUser?: (userId: string) => void;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function verificationRate(verified: number, batches: number): string {
  if (batches === 0) return '—';
  return `${Math.round((verified / batches) * 100)}%`;
}

/** Owner dashboard: coverage → KPIs → charts → daily grid → team summary. */
export function UserActivityOverview({ analytics, hasEntries, onSelectUser }: UserActivityOverviewProps) {
  const { summary, byUser, byClient, byDate, teamCoverage, dailyGrid, avgBatchesPerDay, daysWithAnyActivity } =
    analytics;

  const workloadChart = useMemo(
    () =>
      teamWorkloadChart(
        byUser.map((u) => u.label),
        byUser.map((u) => u.batches),
        byUser.map((u) => u.invoices)
      ),
    [byUser]
  );

  const daysWithActivity = byDate.filter((d) => d.batches > 0).length;
  const showTrend = byDate.length > 1 && daysWithActivity > 0;

  const dateChart = useMemo(
    () =>
      showTrend
        ? activityByDateChart(
            byDate.map((d) => formatShortDate(d.date)),
            byDate.map((d) => d.batches)
          )
        : null,
    [byDate, showTrend]
  );

  const verifiedPct =
    summary.totalBatches > 0
      ? Math.round((summary.verifiedCount / summary.totalBatches) * 100)
      : 0;

  if (!hasEntries && teamCoverage.every((r) => r.batches === 0)) {
    return (
      <div className="space-y-4 mb-6">
        <div className="rounded-xl border border-border bg-panel px-4 py-10 text-center">
          <p className="text-[13px] text-muted2">No worksheet activity in this date range.</p>
          <p className="text-[12px] text-muted mt-1">
            Adjust filters or check back when batches are logged.
          </p>
        </div>
        {teamCoverage.length > 0 && (
          <TeamCoveragePanel rows={teamCoverage} onSelectUser={onSelectUser} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 mb-6">
      {/* Team coverage — always first so you see who logged and who didn't */}
      {teamCoverage.length > 0 && (
        <TeamCoveragePanel rows={teamCoverage} onSelectUser={onSelectUser} />
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          accent
          label="Batches"
          value={summary.totalBatches}
          sub={`${summary.totalInvoices.toLocaleString()} invoices`}
        />
        <StatCard
          label="Active days"
          value={daysWithAnyActivity}
          sub={`~${avgBatchesPerDay} batches/day · ${summary.activeUsers} member${summary.activeUsers !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Verified"
          value={`${verifiedPct}%`}
          sub={`${summary.verifiedCount} of ${summary.totalBatches} batches`}
          valueClassName="text-green"
        />
        <StatCard
          label="Unverified"
          value={summary.unverifiedCount}
          sub={summary.unknownClientCount > 0 ? `+ ${summary.unknownClientCount} not on list` : 'batches need review'}
          valueClassName={summary.unverifiedCount > 0 ? 'text-accent' : 'text-green'}
        />
        <StatCard
          label="Pace flags"
          value={summary.timingReviewCount}
          sub={
            summary.timingReviewCount === 0
              ? `${WORK_MINUTES_PER_INVOICE} min/inv + ${WORK_DURATION_MARGIN_MINUTES} min margin`
              : `${summary.timingSlowCount} slow · ${summary.timingFastCount} fast`
          }
          valueClassName={summary.timingReviewCount > 0 ? 'text-accent2' : 'text-green'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ActivityChart
            title="Team workload — batches per member"
            config={workloadChart}
            height={Math.max(160, byUser.length * 40 + 48)}
          />
        </div>
        <div className="lg:col-span-2">
          {showTrend ? (
            <ActivityChart title="Batches per day" config={dateChart} height={220} />
          ) : (
            <ClientHandoffPanel clients={byClient} max={6} />
          )}
        </div>
      </div>

      {/* Daily heatmap */}
      {dailyGrid.length > 0 && (
        <DailyActivityGrid rows={dailyGrid} onSelectUser={onSelectUser} />
      )}

      {/* Team summary table + client panel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="panel-surface overflow-hidden">
          <div className="px-4 py-[11px] border-b border-border flex items-center justify-between">
            <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
              Team summary
            </span>
            <span className="text-[11px] text-muted2">{summary.totalBatches} batches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-4 py-2">Member</th>
                  <th className="text-right font-normal px-4 py-2 w-16">Batches</th>
                  <th className="text-right font-normal px-4 py-2 w-16">Inv.</th>
                  <th className="text-right font-normal px-4 py-2 w-20">Verified</th>
                  <th className="text-left font-normal px-4 py-2 min-w-[120px]">Top clients</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((u) => (
                  <tr
                    key={u.userId}
                    className="border-b border-border last:border-b-0 row-hover cursor-pointer"
                    onClick={() => onSelectUser?.(u.userId)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectUser?.(u.userId)}
                    tabIndex={onSelectUser ? 0 : undefined}
                    role={onSelectUser ? 'button' : undefined}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink truncate max-w-[180px]">
                      {u.label}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{u.batches}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted2">{u.invoices}</td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                        u.unverified > 0 ? 'text-accent' : 'text-green'
                      }`}
                    >
                      {verificationRate(u.verified, u.batches)}
                    </td>
                    <td
                      className="px-4 py-2.5 text-[12px] text-muted2 truncate max-w-[180px]"
                      title={u.topClients.map((c) => c.name).join(', ')}
                    >
                      {u.topClients.length > 0 ? u.topClients.map((c) => c.name).join(' · ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ClientHandoffPanel clients={byClient} />
      </div>
    </div>
  );
}

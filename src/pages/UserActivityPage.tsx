import { useCallback, useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/Section';
import { ActivityEntryFlags } from '@/components/userActivity/ActivityEntryFlags';
import { WorkPaceCell } from '@/components/userActivity/WorkPaceCell';
import { WorkPaceReviewPanel, type WorkPaceReviewRow } from '@/components/userActivity/WorkPaceReviewPanel';
import { fetchTeamMembers } from '@/lib/supabase-db';
import { exportWorksheetActivityExcel } from '@/lib/exportWorksheetExcel';
import { fmtDateTime, getPriorWeekBoundsDateOnly, getWeekBoundsDateOnly } from '@/lib/utils';
import { UserActivityOverview } from '@/components/userActivity/UserActivityOverview';
import { buildUserActivityAnalytics } from '@/lib/userActivityStats';
import {
  analyzeWorkDurationBetweenBatches,
  entryHasAttentionFlags,
  getWorksheetAuthorLabel,
  getWorksheetEntryDisplayName,
  getWorksheetEntryFlags,
  getWorksheetIssues,
} from '@/lib/worksheetUtils';
import type { UseDataResult } from '@/hooks/useData';
import type { Client, ClientInsurance, TeamMember, WorksheetEntry } from '@/types';

interface UserActivityPageProps
  extends Pick<UseDataResult, 'worksheetEntries' | 'clients' | 'clientInsurance'> {
  ownerId: string;
}

type ViewMode = 'all' | 'issues' | 'pace';

const VIEW_LABELS: Record<ViewMode, string> = {
  all: 'All batches',
  issues: 'Issues',
  pace: 'Pace flags',
};

export function UserActivityPage({
  worksheetEntries,
  clients,
  clientInsurance,
  ownerId,
}: UserActivityPageProps) {
  const week = getWeekBoundsDateOnly();
  const [dateFrom, setDateFrom] = useState(week.start);
  const [dateTo, setDateTo] = useState(week.end);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [exporting, setExporting] = useState(false);
  const [highlightEntryId, setHighlightEntryId] = useState<number | null>(null);

  useEffect(() => {
    void fetchTeamMembers(ownerId).then(setTeamMembers).catch(() => setTeamMembers([]));
  }, [ownerId]);

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const filtered = useMemo(
    () =>
      worksheetEntries
        .filter((e) => e.work_date >= dateFrom && e.work_date <= dateTo)
        .filter((e) => userFilter === 'all' || e.created_by === userFilter)
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (bTime !== aTime) return bTime - aTime;
          return b.work_date.localeCompare(a.work_date) || b.id - a.id;
        }),
    [worksheetEntries, dateFrom, dateTo, userFilter]
  );

  const durationFindings = useMemo(() => analyzeWorkDurationBetweenBatches(filtered), [filtered]);

  const paceReviewRows = useMemo((): WorkPaceReviewRow[] => {
    const rows: WorkPaceReviewRow[] = [];
    for (const [entryId, finding] of durationFindings) {
      const entry = filtered.find((e) => e.id === entryId);
      if (!entry) continue;
      rows.push({
        finding,
        entry,
        userLabel: getWorksheetAuthorLabel(entry.created_by, ownerId, teamMembers),
        clientName: getWorksheetEntryDisplayName(entry, clientsById),
      });
    }
    return rows.sort((a, b) => b.finding.gapMinutes - a.finding.gapMinutes);
  }, [durationFindings, filtered, clientsById, ownerId, teamMembers]);

  const tableRows = useMemo(() => {
    if (viewMode === 'pace') return filtered.filter((e) => durationFindings.has(e.id));
    if (viewMode === 'issues')
      return filtered.filter((e) =>
        entryHasAttentionFlags(getWorksheetEntryFlags(e, clientsById, clientInsurance, durationFindings))
      );
    return filtered;
  }, [filtered, viewMode, clientsById, clientInsurance, durationFindings]);

  useEffect(() => {
    if (highlightEntryId == null) return;
    document
      .getElementById(`activity-row-${highlightEntryId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightEntryId, tableRows]);

  const issues = useMemo(
    () => getWorksheetIssues(filtered, clientsById, clientInsurance),
    [filtered, clientsById, clientInsurance]
  );

  const issueSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of issues) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
    return counts;
  }, [issues]);

  const analytics = useMemo(
    () => buildUserActivityAnalytics(filtered, clientsById, ownerId, teamMembers, dateFrom, dateTo),
    [filtered, clientsById, ownerId, teamMembers, dateFrom, dateTo]
  );

  const authorOptions = useMemo(() => {
    const ids = new Set(filtered.map((e) => e.created_by));
    return Array.from(ids).map((id) => ({
      id,
      label: getWorksheetAuthorLabel(id, ownerId, teamMembers),
    }));
  }, [filtered, ownerId, teamMembers]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const rows = filtered.map((e) => {
        const client = e.client_id != null ? clientsById.get(e.client_id) : undefined;
        return {
          entry: e,
          clientName: getWorksheetEntryDisplayName(e, clientsById),
          authorLabel: getWorksheetAuthorLabel(e.created_by, ownerId, teamMembers),
          expenses: client?.expenses ?? '',
          warningNote: client?.warning_note?.trim() ?? '',
        };
      });
      await exportWorksheetActivityExcel(rows);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [filtered, clientsById, ownerId, teamMembers]);

  const issuePills: { label: string; key: string }[] = [
    { label: `${issueSummary.get('unverified') ?? 0} unverified`, key: 'unverified' },
    { label: `${issueSummary.get('unknown_client') ?? 0} not on list`, key: 'unknown_client' },
    { label: `${issueSummary.get('work_duration_slow') ?? 0} slow pace`, key: 'work_duration_slow' },
    { label: `${issueSummary.get('work_duration_fast') ?? 0} fast pace`, key: 'work_duration_fast' },
    { label: `${issueSummary.get('warning_note') ?? 0} warnings`, key: 'warning_note' },
    { label: `${issueSummary.get('insurance_cancellation') ?? 0} insurance`, key: 'insurance_cancellation' },
    { label: `${issueSummary.get('new_client_review') ?? 0} new-client review`, key: 'new_client_review' },
  ].filter((p) => (issueSummary.get(p.key) ?? 0) > 0);

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <h1 className="page-title">User Activity</h1>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || filtered.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="panel-surface px-4 py-3 mb-5 flex flex-wrap items-end gap-x-5 gap-y-3">
        {/* Quick range */}
        <div className="flex gap-1.5">
          {[
            { label: 'This week', fn: getWeekBoundsDateOnly },
            { label: 'Last week', fn: getPriorWeekBoundsDateOnly },
          ].map(({ label, fn }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const w = fn();
                setDateFrom(w.start);
                setDateTo(w.end);
                setViewMode('all');
              }}
              className="text-[12px] px-3 py-1.5 rounded-md border border-border bg-surface text-ink hover:border-accent/50 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink"
            />
          </div>
        </div>

        {/* User */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">User</label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink min-w-[150px]"
          >
            <option value="all">All users</option>
            {authorOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="ml-auto">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">View</label>
          <div className="flex rounded-md overflow-hidden border border-border text-[12px]">
            {(['all', 'issues', 'pace'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === m
                    ? 'bg-accent text-page font-medium'
                    : 'bg-surface text-ink hover:bg-row-hover'
                }`}
              >
                {VIEW_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Exceptions summary banner ── */}
      {issues.length > 0 && (
        <div className="mb-5 rounded-xl border border-red/25 bg-red/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-red">
              {issues.length} exception{issues.length !== 1 ? 's' : ''}
            </span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {issuePills.map((p) => (
                <span
                  key={p.key}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-red/20 bg-red/10 text-red/80"
                >
                  {p.label}
                </span>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIssuesExpanded((v) => !v)}
                className="text-[12px] text-muted2 hover:text-ink"
              >
                {issuesExpanded ? 'Hide detail' : 'Show detail'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('issues');
                  setHighlightEntryId(issues[0]?.entryId ?? null);
                }}
                className="text-[12px] text-accent hover:underline"
              >
                Filter table →
              </button>
            </div>
          </div>

          {issuesExpanded && (
            <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto border-t border-red/15 pt-3 text-[12px] text-ink list-disc list-inside">
              {issues.slice(0, 12).map((issue, i) => (
                <li key={`${issue.entryId}-${issue.type}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('issues');
                      setHighlightEntryId(issue.entryId);
                    }}
                    className="text-left hover:text-accent hover:underline underline-offset-2"
                  >
                    {issue.message}
                  </button>
                </li>
              ))}
              {issues.length > 12 && (
                <li className="text-muted2 list-none">
                  +{issues.length - 12} more — use "Issues" view or export
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* ── Analytics overview (KPIs + charts + daily grid + team summary) ── */}
      <UserActivityOverview
        analytics={analytics}
        hasEntries={filtered.length > 0}
        onSelectUser={(id) => {
          setUserFilter(id);
          setViewMode('all');
        }}
      />

      {/* ── Work pace review ── */}
      {paceReviewRows.length > 0 && (
        <WorkPaceReviewPanel
          rows={paceReviewRows}
          onSelectEntry={(id) => {
            setViewMode('pace');
            setHighlightEntryId(id);
          }}
        />
      )}

      {/* ── Batch log ── */}
      <Section
        title={
          viewMode === 'pace'
            ? `Pace review`
            : viewMode === 'issues'
              ? `Exceptions`
              : `Batch log`
        }
        count={tableRows.length}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
                <th className="text-left font-normal px-4 py-2.5 w-[150px]">Timestamp</th>
                <th className="text-left font-normal px-4 py-2.5 w-[130px]">User</th>
                <th className="text-left font-normal px-4 py-2.5">Client</th>
                <th className="text-right font-normal px-4 py-2.5 w-14">Inv.</th>
                <th className="text-left font-normal px-4 py-2.5 w-28">Pace</th>
                <th className="text-center font-normal px-4 py-2.5 w-20">Verified</th>
                <th className="text-left font-normal px-4 py-2.5 w-[160px]">Flags</th>
                <th className="text-left font-normal px-4 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((e) => (
                <ActivityRow
                  key={e.id}
                  entry={e}
                  highlighted={highlightEntryId === e.id}
                  clientsById={clientsById}
                  clientInsurance={clientInsurance}
                  durationFindings={durationFindings}
                  ownerId={ownerId}
                  teamMembers={teamMembers}
                />
              ))}
            </tbody>
          </table>
          {tableRows.length === 0 && (
            <p className="text-muted2 text-[13px] py-8 text-center">
              {viewMode === 'pace'
                ? 'No pace flags in this range.'
                : viewMode === 'issues'
                  ? 'No batches with exceptions in this range.'
                  : 'No activity in this range.'}
            </p>
          )}
        </div>
      </Section>
    </>
  );
}

function ActivityRow({
  entry,
  highlighted,
  clientsById,
  clientInsurance,
  durationFindings,
  ownerId,
  teamMembers,
}: {
  entry: WorksheetEntry;
  highlighted?: boolean;
  clientsById: Map<number, Client>;
  clientInsurance: ClientInsurance[];
  durationFindings: ReturnType<typeof analyzeWorkDurationBetweenBatches>;
  ownerId: string;
  teamMembers: TeamMember[];
}) {
  const displayName = getWorksheetEntryDisplayName(entry, clientsById);
  const flags = getWorksheetEntryFlags(entry, clientsById, clientInsurance, durationFindings);
  const nonPaceFlags = flags.filter((f) => f.type !== 'timing_slow' && f.type !== 'timing_fast' && f.type !== 'group');
  const needsAttention = entryHasAttentionFlags(flags);
  const author = getWorksheetAuthorLabel(entry.created_by, ownerId, teamMembers);

  return (
    <tr
      id={`activity-row-${entry.id}`}
      className={`border-b border-border row-hover ${
        highlighted
          ? 'bg-accent/15 ring-1 ring-inset ring-accent/30'
          : needsAttention
            ? 'bg-accent/[0.03]'
            : ''
      }`}
    >
      <td
        className="px-4 py-3 text-[12px] text-muted2 tabular-nums whitespace-nowrap"
        title={entry.created_at ?? undefined}
      >
        {fmtDateTime(entry.created_at)}
      </td>
      <td className="px-4 py-3 text-[12px] text-muted2 truncate max-w-[130px]" title={author}>
        {author}
      </td>
      <td className="px-4 py-3 font-medium text-ink max-w-[200px]">
        <span className="block truncate" title={displayName}>
          {displayName}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-ink">{entry.invoice_count}</td>
      <td className="px-4 py-3">
        <WorkPaceCell finding={durationFindings.get(entry.id)} />
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={
            entry.verified
              ? 'text-[12px] font-medium text-green'
              : 'text-[12px] font-semibold text-red'
          }
        >
          {entry.verified ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="px-4 py-3">
        <ActivityEntryFlags flags={nonPaceFlags} hideNeutralWhenClean />
      </td>
      <td className="px-4 py-3 text-[12px] text-muted2 max-w-[180px] truncate" title={entry.note || undefined}>
        {entry.note?.trim() || '—'}
      </td>
    </tr>
  );
}

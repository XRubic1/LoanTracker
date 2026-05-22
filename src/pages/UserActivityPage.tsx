import { useCallback, useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/Section';
import { ActivityEntryFlags } from '@/components/userActivity/ActivityEntryFlags';
import { fetchTeamMembers } from '@/lib/supabase-db';
import { exportWorksheetActivityExcel } from '@/lib/exportWorksheetExcel';
import { getPriorWeekBoundsDateOnly, getWeekBoundsDateOnly } from '@/lib/utils';
import { UserActivityOverview } from '@/components/userActivity/UserActivityOverview';
import { buildUserActivityAnalytics } from '@/lib/userActivityStats';
import {
  entryHasAttentionFlags,
  getWorksheetAuthorLabel,
  getWorksheetEntryDisplayName,
  getWorksheetEntryFlags,
  getWorksheetIssues,
} from '@/lib/worksheetUtils';
import type { UseDataResult } from '@/hooks/useData';
import type { Client, ClientInsurance, TeamMember, WorksheetEntry } from '@/types';

interface UserActivityPageProps extends Pick<UseDataResult, 'worksheetEntries' | 'clients' | 'clientInsurance'> {
  ownerId: string;
}

export function UserActivityPage({ worksheetEntries, clients, clientInsurance, ownerId }: UserActivityPageProps) {
  const week = getWeekBoundsDateOnly();
  const [dateFrom, setDateFrom] = useState(week.start);
  const [dateTo, setDateTo] = useState(week.end);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [exporting, setExporting] = useState(false);
  const [highlightEntryId, setHighlightEntryId] = useState<number | null>(null);

  useEffect(() => {
    void fetchTeamMembers(ownerId).then(setTeamMembers).catch(() => setTeamMembers([]));
  }, [ownerId]);

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const filtered = useMemo(() => {
    return worksheetEntries
      .filter((e) => e.work_date >= dateFrom && e.work_date <= dateTo)
      .filter((e) => userFilter === 'all' || e.created_by === userFilter)
      .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id);
  }, [worksheetEntries, dateFrom, dateTo, userFilter]);

  const tableRows = useMemo(() => {
    if (!issuesOnly) return filtered;
    return filtered.filter((e) =>
      entryHasAttentionFlags(getWorksheetEntryFlags(e, clientsById, clientInsurance))
    );
  }, [filtered, issuesOnly, clientsById, clientInsurance]);

  useEffect(() => {
    if (highlightEntryId == null) return;
    document.getElementById(`activity-row-${highlightEntryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightEntryId, tableRows]);

  const issues = useMemo(
    () => getWorksheetIssues(filtered, clientsById, clientInsurance),
    [filtered, clientsById, clientInsurance]
  );

  const issueSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of issues) {
      counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
    }
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

  return (
    <>
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

      <p className="text-muted2 text-[13px] mb-4 max-w-2xl">
        Accountability (who logged work), workload, client handoffs, and exceptions — use the batch log for
        full detail.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => {
            const w = getWeekBoundsDateOnly();
            setDateFrom(w.start);
            setDateTo(w.end);
            setIssuesOnly(false);
          }}
          className="text-[12px] px-3 py-1.5 rounded-lg border border-border bg-surface text-ink hover:border-accent/40 transition-colors"
        >
          This week
        </button>
        <button
          type="button"
          onClick={() => {
            const w = getPriorWeekBoundsDateOnly();
            setDateFrom(w.start);
            setDateTo(w.end);
            setIssuesOnly(false);
          }}
          className="text-[12px] px-3 py-1.5 rounded-lg border border-border bg-surface text-ink hover:border-accent/40 transition-colors"
        >
          Last week
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">User</label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink min-w-[160px]"
          >
            <option value="all">All users</option>
            {authorOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={issuesOnly}
            onChange={(e) => setIssuesOnly(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-[13px] text-ink">Issues only</span>
        </label>
      </div>

      {issues.length > 0 && (
        <div className="mb-4 rounded-xl border border-red/30 bg-red/5 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <p className="text-[13px] font-medium text-red">
              {issues.length} exception{issues.length !== 1 ? 's' : ''} in this range
            </p>
            <button
              type="button"
              onClick={() => {
                setIssuesOnly(true);
                setHighlightEntryId(issues[0]?.entryId ?? null);
              }}
              className="text-[12px] text-accent hover:underline"
            >
              Show in table
            </button>
          </div>
          <p className="text-[12px] text-muted2 mb-2">
            {[
              issueSummary.get('unverified') && `${issueSummary.get('unverified')} unverified`,
              issueSummary.get('unknown_client') && `${issueSummary.get('unknown_client')} not on list`,
              issueSummary.get('warning_note') && `${issueSummary.get('warning_note')} warnings`,
              issueSummary.get('new_client_review') && `${issueSummary.get('new_client_review')} new-client reviews`,
              issueSummary.get('insurance_cancellation') &&
                `${issueSummary.get('insurance_cancellation')} insurance verify`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ul className="text-[12px] text-ink space-y-1 max-h-28 overflow-y-auto list-disc list-inside">
            {issues.slice(0, 8).map((issue, i) => (
              <li key={`${issue.entryId}-${issue.type}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIssuesOnly(true);
                    setHighlightEntryId(issue.entryId);
                  }}
                  className="text-left hover:text-accent underline-offset-2 hover:underline"
                >
                  {issue.message}
                </button>
              </li>
            ))}
            {issues.length > 8 && (
              <li className="text-muted2 list-none">+{issues.length - 8} more — use “Issues only” or export</li>
            )}
          </ul>
        </div>
      )}

      <UserActivityOverview
        analytics={analytics}
        hasEntries={filtered.length > 0}
        onSelectUser={(id) => {
          setUserFilter(id);
          setIssuesOnly(false);
        }}
      />

      <Section
        title={
          issuesOnly
            ? `Exceptions (${tableRows.length})`
            : `Batch log (${tableRows.length})`
        }
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-label">
                <th className="text-left font-normal px-3 py-2 w-[100px]">Date</th>
                <th className="text-left font-normal px-3 py-2 w-[120px]">User</th>
                <th className="text-left font-normal px-3 py-2">Client</th>
                <th className="text-right font-normal px-3 py-2 w-16">Inv.</th>
                <th className="text-center font-normal px-3 py-2 w-20">Verified</th>
                <th className="text-center font-normal px-3 py-2 min-w-[160px]">Flags</th>
                <th className="text-left font-normal px-3 py-2 max-w-[200px]">Note</th>
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
                  ownerId={ownerId}
                  teamMembers={teamMembers}
                />
              ))}
            </tbody>
          </table>
          {tableRows.length === 0 && (
            <p className="text-muted2 text-[13px] py-8 text-center">
              {issuesOnly
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
  ownerId,
  teamMembers,
}: {
  entry: WorksheetEntry;
  highlighted?: boolean;
  clientsById: Map<number, Client>;
  clientInsurance: ClientInsurance[];
  ownerId: string;
  teamMembers: TeamMember[];
}) {
  const displayName = getWorksheetEntryDisplayName(entry, clientsById);
  const flags = getWorksheetEntryFlags(entry, clientsById, clientInsurance);
  const needsAttention = entryHasAttentionFlags(flags);
  const author = getWorksheetAuthorLabel(entry.created_by, ownerId, teamMembers);

  return (
    <tr
      id={`activity-row-${entry.id}`}
      className={`border-b border-border row-hover ${
        highlighted ? 'bg-accent/15 ring-1 ring-inset ring-accent/30' : needsAttention ? 'bg-accent/5' : ''
      }`}
    >
      <td className="px-3 py-2.5 text-muted2 tabular-nums whitespace-nowrap">{entry.work_date}</td>
      <td className="px-3 py-2.5 text-[12px] text-muted2 truncate max-w-[120px]" title={author}>
        {author}
      </td>
      <td className="px-3 py-2.5 font-medium text-ink">
        <span className="line-clamp-2" title={displayName}>
          {displayName}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{entry.invoice_count}</td>
      <td className="px-3 py-2.5 text-center">
        <span
          className={
            entry.verified
              ? 'text-green text-[12px] font-medium'
              : 'text-red text-[12px] font-semibold'
          }
        >
          {entry.verified ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <ActivityEntryFlags flags={flags} hideNeutralWhenClean />
      </td>
      <td className="px-3 py-2.5 text-[12px] text-muted2 truncate max-w-[200px]" title={entry.note || undefined}>
        {entry.note?.trim() || '—'}
      </td>
    </tr>
  );
}

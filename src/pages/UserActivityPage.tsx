import { useCallback, useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/Section';
import { fetchTeamMembers } from '@/lib/supabase-db';
import { exportWorksheetActivityExcel } from '@/lib/exportWorksheetExcel';
import { getWeekBoundsDateOnly } from '@/lib/utils';
import { UserActivityOverview } from '@/components/userActivity/UserActivityOverview';
import { WorksheetClientAlerts } from '@/components/WorksheetClientAlerts';
import { buildUserActivityAnalytics } from '@/lib/userActivityStats';
import {
  findInsuranceForClient,
  getWorksheetAuthorLabel,
  getWorksheetClientAlerts,
  getWorksheetEntryDisplayName,
  getWorksheetIssues,
  hasWorksheetClientAlerts,
  isWorksheetUnknownClientEntry,
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [exporting, setExporting] = useState(false);

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

  const issues = useMemo(
    () => getWorksheetIssues(filtered, clientsById, clientInsurance),
    [filtered, clientsById, clientInsurance]
  );

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

      <p className="text-muted2 text-[13px] mb-4">
        Visual overview of team worksheet activity, then the full batch list below.
      </p>

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
      </div>

      {issues.length > 0 && (
        <div className="mb-4 rounded-xl border border-red/30 bg-red/5 px-4 py-3">
          <p className="text-[13px] font-medium text-red mb-2">{issues.length} issue{issues.length !== 1 ? 's' : ''}</p>
          <ul className="text-[12px] text-ink space-y-1 max-h-32 overflow-y-auto">
            {issues.slice(0, 20).map((issue, i) => (
              <li key={`${issue.entryId}-${issue.type}-${i}`}>{issue.message}</li>
            ))}
            {issues.length > 20 && <li className="text-muted2">+{issues.length - 20} more</li>}
          </ul>
        </div>
      )}

      <UserActivityOverview analytics={analytics} hasEntries={filtered.length > 0} />

      <Section title={`All batches (${filtered.length})`}>
        <div className="overflow-x-auto -mx-1">
          <table className="data-table w-full min-w-[900px] [&_th]:text-center [&_td]:text-center">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Client</th>
                <th>Invoices</th>
                <th>Group</th>
                <th>Verified</th>
                <th>Expenses</th>
                <th className="min-w-[200px]">Alerts</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <ActivityRow
                  key={e.id}
                  entry={e}
                  clientsById={clientsById}
                  clientInsurance={clientInsurance}
                  ownerId={ownerId}
                  teamMembers={teamMembers}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-muted2 text-[13px] py-6 text-center">No activity in this range.</p>
          )}
        </div>
      </Section>
    </>
  );
}

function ActivityRow({
  entry,
  clientsById,
  clientInsurance,
  ownerId,
  teamMembers,
}: {
  entry: WorksheetEntry;
  clientsById: Map<number, Client>;
  clientInsurance: ClientInsurance[];
  ownerId: string;
  teamMembers: TeamMember[];
}) {
  const unknown = isWorksheetUnknownClientEntry(entry);
  const client = entry.client_id != null ? clientsById.get(entry.client_id) : undefined;
  const displayName = getWorksheetEntryDisplayName(entry, clientsById);
  const insurance = client ? findInsuranceForClient(client, clientInsurance) : null;
  const alerts = client ? getWorksheetClientAlerts(client, insurance) : null;
  const author = getWorksheetAuthorLabel(entry.created_by, ownerId, teamMembers);
  const highlight =
    unknown ||
    !entry.verified ||
    (alerts && hasWorksheetClientAlerts(alerts)) ||
    (alerts?.requiresFullVerification && !entry.verified);
  return (
    <tr className={highlight ? 'bg-accent/5' : undefined}>
      <td>{entry.work_date}</td>
      <td className="text-[12px] text-muted2">{author}</td>
      <td className="font-medium text-ink">
        {displayName}
        {unknown && (
          <span className="block text-[10px] font-normal text-accent mt-0.5">Not on client list</span>
        )}
      </td>
      <td>{entry.invoice_count}</td>
      <td>{entry.group_work ? 'YES' : 'NO'}</td>
      <td
        className={
          entry.verified
            ? 'text-green'
            : alerts?.requiresFullVerification
              ? 'text-red font-semibold'
              : 'text-accent'
        }
      >
        {entry.verified ? 'YES' : 'NO'}
      </td>
      <td className="text-muted2">{client?.expenses ?? '—'}</td>
      <td className="align-middle py-2 max-w-[280px]">
        {client && alerts && hasWorksheetClientAlerts(alerts) ? (
          <WorksheetClientAlerts client={client} insurance={insurance} variant="compact" alerts={alerts} />
        ) : (
          <span className="text-muted2 text-[12px]">—</span>
        )}
      </td>
      <td className="text-[12px] max-w-[120px] text-muted2">{entry.note || '—'}</td>
    </tr>
  );
}

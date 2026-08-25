import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllClientInsuranceForAdmin,
  fetchAllClientsForAdmin,
  fetchAllWorksheetEntriesForAdmin,
  fetchCompaniesForAdmin,
  fetchTeamMembers,
} from '@/lib/supabase-db';
import type { Client, ClientInsurance, WorksheetEntry } from '@/types';
import {
  fmtDateTime,
  getPriorWeekBoundsDateOnly,
  getWeekBoundsDateOnly,
} from '@/lib/utils';
import {
  analyzeWorkDurationBetweenBatches,
  entryHasAttentionFlags,
  getWorksheetEntryDisplayName,
  getWorksheetEntryFlags,
} from '@/lib/worksheetUtils';
import { ActivityEntryFlags } from '@/components/userActivity/ActivityEntryFlags';
import { WorkPaceCell } from '@/components/userActivity/WorkPaceCell';
import { AdminActivityDetailModal } from '@/components/superAdmin/AdminActivityDetailModal';

/**
 * Platform-wide worksheet activity with filters, summary, and batch detail.
 */
export function AllActivityTab() {
  const week = getWeekBoundsDateOnly();
  const [entries, setEntries] = useState<WorksheetEntry[]>([]);
  const [clientsById, setClientsById] = useState<Map<number, Client>>(new Map());
  const [clientInsurance, setClientInsurance] = useState<ClientInsurance[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string; owner_id: string | null }[]>(
    []
  );
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(week.start);
  const [dateTo, setDateTo] = useState(week.end);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'issues'>('all');
  const [teamLabels, setTeamLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<WorksheetEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyId = companyFilter === 'all' ? null : companyFilter;
      const [companyRows, entryRows, clientRows, insuranceRows] = await Promise.all([
        fetchCompaniesForAdmin(),
        fetchAllWorksheetEntriesForAdmin(companyId),
        fetchAllClientsForAdmin(companyId),
        fetchAllClientInsuranceForAdmin(companyId),
      ]);
      setCompanies(
        companyRows.map((c) => ({ id: c.id, name: c.name, owner_id: c.owner_id }))
      );
      setEntries(entryRows);
      setClientsById(new Map(clientRows.map((r) => [r.client.id, r.client])));
      setClientInsurance(insuranceRows.map((r) => r.record));

      const ownerIds = [
        ...new Set(companyRows.map((c) => c.owner_id).filter(Boolean)),
      ] as string[];
      const labelMap = new Map<string, string>();
      await Promise.all(
        ownerIds.map(async (oid) => {
          try {
            const members = await fetchTeamMembers(oid);
            for (const m of members) {
              if (m.member_id) labelMap.set(m.member_id, m.email);
            }
          } catch {
            /* ignore per-team failures */
          }
          labelMap.set(oid, 'Team admin');
        })
      );
      setTeamLabels(labelMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [companyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerToCompany = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) {
      if (c.owner_id) m.set(c.owner_id, c.name);
    }
    return m;
  }, [companies]);

  const userLabel = useCallback(
    (createdBy: string, ownerId: string) =>
      teamLabels.get(createdBy) ??
      (createdBy === ownerId ? 'Team admin' : createdBy.slice(0, 8)),
    [teamLabels]
  );

  const ranged = useMemo(
    () =>
      entries.filter((e) => e.work_date >= dateFrom && e.work_date <= dateTo),
    [entries, dateFrom, dateTo]
  );

  const durationFindings = useMemo(
    () => analyzeWorkDurationBetweenBatches(ranged),
    [ranged]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ranged
      .filter((e) => userFilter === 'all' || e.created_by === userFilter)
      .filter((e) => {
        if (!q) return true;
        const company = (ownerToCompany.get(e.owner_id) ?? '').toLowerCase();
        const author = userLabel(e.created_by, e.owner_id).toLowerCase();
        const client = getWorksheetEntryDisplayName(e, clientsById).toLowerCase();
        const note = (e.note ?? '').toLowerCase();
        return (
          company.includes(q) ||
          author.includes(q) ||
          client.includes(q) ||
          note.includes(q)
        );
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
        return b.work_date.localeCompare(a.work_date) || b.id - a.id;
      });
  }, [ranged, userFilter, search, ownerToCompany, userLabel, clientsById]);

  const tableRows = useMemo(() => {
    if (viewMode !== 'issues') return filtered;
    return filtered.filter((e) =>
      entryHasAttentionFlags(
        getWorksheetEntryFlags(e, clientsById, clientInsurance, durationFindings)
      )
    );
  }, [filtered, viewMode, clientsById, clientInsurance, durationFindings]);

  const authorOptions = useMemo(() => {
    const ids = new Set(ranged.map((e) => e.created_by));
    return Array.from(ids)
      .map((id) => {
        const sample = ranged.find((e) => e.created_by === id);
        return {
          id,
          label: userLabel(id, sample?.owner_id ?? id),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ranged, userLabel]);

  const summary = useMemo(() => {
    let invoices = 0;
    let unverified = 0;
    const users = new Set<string>();
    for (const e of filtered) {
      invoices += e.invoice_count;
      if (!e.verified) unverified += 1;
      users.add(e.created_by);
    }
    return {
      batches: filtered.length,
      invoices,
      unverified,
      users: users.size,
    };
  }, [filtered]);

  const relatedEntries = useMemo(() => {
    if (!detailEntry) return [];
    return filtered
      .filter(
        (e) =>
          e.id !== detailEntry.id &&
          e.created_by === detailEntry.created_by &&
          e.work_date === detailEntry.work_date
      )
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [detailEntry, filtered]);

  const setThisWeek = () => {
    const w = getWeekBoundsDateOnly();
    setDateFrom(w.start);
    setDateTo(w.end);
  };

  const setLastWeek = () => {
    const w = getPriorWeekBoundsDateOnly();
    setDateFrom(w.start);
    setDateTo(w.end);
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {error && (
        <div className="flex-shrink-0 rounded border border-red/30 bg-red/5 px-3 py-1.5 text-[12px] text-red">
          {error}
        </div>
      )}

      {!loading && (
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Batches</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink truncate">
              {summary.batches}
            </div>
            <div className="text-[10px] text-muted2 mt-1">in range</div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Invoices</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink truncate">
              {summary.invoices}
            </div>
            <div className="text-[10px] text-muted2 mt-1">logged</div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Users</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink truncate">
              {summary.users}
            </div>
            <div className="text-[10px] text-muted2 mt-1">active</div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Unverified</div>
            <div
              className={`text-[16px] font-medium leading-none tabular-nums truncate ${
                summary.unverified > 0 ? 'text-red' : 'text-ink'
              }`}
            >
              {summary.unverified}
            </div>
            <div className="text-[10px] text-muted2 mt-1">need review</div>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-muted2" htmlFor="activity-from">
            From
          </label>
          <input
            id="activity-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value || dateFrom)}
            className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
          />
          <label className="text-[11px] text-muted2" htmlFor="activity-to">
            To
          </label>
          <input
            id="activity-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value || dateTo)}
            className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
          />
          <button type="button" onClick={setThisWeek} className="filter-btn">
            This week
          </button>
          <button type="button" onClick={setLastWeek} className="filter-btn">
            Last week
          </button>
        </div>

        <select
          value={companyFilter === 'all' ? 'all' : String(companyFilter)}
          onChange={(e) =>
            setCompanyFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink min-w-[140px]"
          aria-label="Team filter"
        >
          <option value="all">All teams</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink min-w-[140px]"
          aria-label="User filter"
        >
          <option value="all">All users</option>
          {authorOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`filter-btn ${viewMode === 'all' ? 'filter-btn-active' : ''}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setViewMode('issues')}
            className={`filter-btn ${viewMode === 'issues' ? 'filter-btn-active' : ''}`}
          >
            Issues
          </button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Client, user, team, note…"
          className="flex-1 min-w-[140px] rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
        />

        {!loading && (
          <span className="text-[11px] text-muted2">
            {tableRows.length} shown · click row for detail
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[12px] py-6 text-center">Loading activity…</p>
      ) : tableRows.length === 0 ? (
        <div className="panel-surface flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-muted2 text-[12px]">
            {viewMode === 'issues'
              ? 'No batches with issues in this range.'
              : 'No worksheet activity in this range.'}
          </p>
        </div>
      ) : (
        <div className="panel-surface flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll">
            <table className="w-full border-collapse text-[12px] min-w-[980px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-3 py-1.5">Saved</th>
                  <th className="text-left font-normal px-3 py-1.5">Work date</th>
                  <th className="text-left font-normal px-3 py-1.5">Team</th>
                  <th className="text-left font-normal px-3 py-1.5">User</th>
                  <th className="text-left font-normal px-3 py-1.5">Client</th>
                  <th className="text-right font-normal px-3 py-1.5">Inv.</th>
                  <th className="text-left font-normal px-3 py-1.5">Pace</th>
                  <th className="text-center font-normal px-3 py-1.5">Verified</th>
                  <th className="text-left font-normal px-3 py-1.5">Flags</th>
                  <th className="text-left font-normal px-3 py-1.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((e) => {
                  const flags = getWorksheetEntryFlags(
                    e,
                    clientsById,
                    clientInsurance,
                    durationFindings
                  );
                  const nonPaceFlags = flags.filter(
                    (f) =>
                      f.type !== 'timing_slow' &&
                      f.type !== 'timing_fast' &&
                      f.type !== 'group'
                  );
                  const needsAttention = entryHasAttentionFlags(flags);
                  const author = userLabel(e.created_by, e.owner_id);
                  const clientName = getWorksheetEntryDisplayName(e, clientsById);

                  return (
                    <tr
                      key={e.id}
                      className={`border-b border-border last:border-b-0 row-hover cursor-pointer ${
                        needsAttention ? 'bg-accent/[0.03]' : ''
                      }`}
                      onClick={() => setDetailEntry(e)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          setDetailEntry(e);
                        }
                      }}
                      tabIndex={0}
                      title="View activity detail"
                    >
                      <td
                        className="px-3 py-1 text-muted2 tabular-nums whitespace-nowrap"
                        title={e.created_at ?? undefined}
                      >
                        {fmtDateTime(e.created_at)}
                      </td>
                      <td className="px-3 py-1 text-muted2 tabular-nums">{e.work_date}</td>
                      <td className="px-3 py-1 text-muted2 truncate max-w-[120px]">
                        {ownerToCompany.get(e.owner_id) ?? '—'}
                      </td>
                      <td
                        className="px-3 py-1 text-ink truncate max-w-[130px]"
                        title={author}
                      >
                        {author}
                      </td>
                      <td className="px-3 py-1 font-medium text-ink truncate max-w-[160px]" title={clientName}>
                        {clientName}
                      </td>
                      <td className="px-3 py-1 text-right tabular-nums text-ink">
                        {e.invoice_count}
                      </td>
                      <td className="px-3 py-1">
                        <WorkPaceCell finding={durationFindings.get(e.id)} />
                      </td>
                      <td className="px-3 py-1 text-center">
                        <span
                          className={
                            e.verified
                              ? 'text-[12px] font-medium text-green'
                              : 'text-[12px] font-semibold text-red'
                          }
                        >
                          {e.verified ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-3 py-1">
                        <ActivityEntryFlags flags={nonPaceFlags} hideNeutralWhenClean />
                      </td>
                      <td
                        className="px-3 py-1 text-muted2 max-w-[160px] truncate"
                        title={e.note || undefined}
                      >
                        {e.note?.trim() || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminActivityDetailModal
        open={detailEntry != null}
        entry={detailEntry}
        companyName={
          detailEntry ? ownerToCompany.get(detailEntry.owner_id) ?? null : null
        }
        userLabel={
          detailEntry
            ? userLabel(detailEntry.created_by, detailEntry.owner_id)
            : ''
        }
        clientsById={clientsById}
        clientInsurance={clientInsurance}
        durationFinding={
          detailEntry ? durationFindings.get(detailEntry.id) ?? null : null
        }
        relatedEntries={relatedEntries}
        onClose={() => setDetailEntry(null)}
        onSelectRelated={setDetailEntry}
      />
    </div>
  );
}

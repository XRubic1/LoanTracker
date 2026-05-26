import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllWorksheetEntriesForAdmin,
  fetchCompaniesForAdmin,
  fetchTeamMembers,
} from '@/lib/supabase-db';
import type { WorksheetEntry } from '@/types';

export function AllActivityTab() {
  const [entries, setEntries] = useState<WorksheetEntry[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string; owner_id: string | null }[]>(
    []
  );
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [teamLabels, setTeamLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyRows = await fetchCompaniesForAdmin();
      setCompanies(
        companyRows.map((c) => ({ id: c.id, name: c.name, owner_id: c.owner_id }))
      );
      const list = await fetchAllWorksheetEntriesForAdmin(
        companyFilter === 'all' ? null : companyFilter
      );
      setEntries(list);

      const ownerIds = [...new Set(companyRows.map((c) => c.owner_id).filter(Boolean))] as string[];
      const labelMap = new Map<string, string>();
      for (const oid of ownerIds) {
        const members = await fetchTeamMembers(oid);
        for (const m of members) {
          if (m.member_id) labelMap.set(m.member_id, m.email);
        }
        labelMap.set(oid, 'Team admin');
      }
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

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id
      ),
    [entries]
  );

  return (
    <div className="space-y-4">
      <p className="text-muted2 text-[13px]">
        Worksheet batches across all companies (read-only).
      </p>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[13px] text-red">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Company</label>
        <select
          value={companyFilter === 'all' ? 'all' : String(companyFilter)}
          onChange={(e) =>
            setCompanyFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink min-w-[180px]"
        >
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted2 text-[13px]">Loading activity…</p>
      ) : (
        <div className="panel-surface overflow-x-auto">
          <table className="w-full border-collapse text-[13px] min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
                <th className="text-left font-normal px-4 py-2.5">Company</th>
                <th className="text-left font-normal px-4 py-2.5">Date</th>
                <th className="text-left font-normal px-4 py-2.5">User</th>
                <th className="text-right font-normal px-4 py-2.5 w-16">Inv.</th>
                <th className="text-center font-normal px-4 py-2.5 w-20">Verified</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 200).map((e) => (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 text-[12px] text-muted2">
                    {ownerToCompany.get(e.owner_id ?? '') ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted2">{e.work_date}</td>
                  <td className="px-4 py-2.5 text-ink">
                    {teamLabels.get(e.created_by) ??
                      (e.created_by === e.owner_id ? 'Team admin' : e.created_by.slice(0, 8))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e.invoice_count}</td>
                  <td className="px-4 py-2.5 text-center">
                    {e.verified ? (
                      <span className="text-green text-[12px]">Yes</span>
                    ) : (
                      <span className="text-red text-[12px]">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <p className="text-muted2 text-[13px] py-8 text-center">No worksheet activity.</p>
          )}
          {sorted.length > 200 && (
            <p className="text-[12px] text-muted2 px-4 py-2 border-t border-border">
              Showing first 200 of {sorted.length} batches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

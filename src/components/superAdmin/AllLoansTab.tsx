import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllLoansForAdmin, fetchCompaniesForAdmin } from '@/lib/supabase-db';
import type { AdminLoanRow } from '@/lib/supabase-db';
import { fmt, fmtDate, getLoanRemaining } from '@/lib/utils';

export function AllLoansTab() {
  const [rows, setRows] = useState<AdminLoanRow[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loanRows, companyRows] = await Promise.all([
        fetchAllLoansForAdmin(companyFilter === 'all' ? null : companyFilter),
        fetchCompaniesForAdmin(),
      ]);
      setRows(loanRows);
      setCompanies(companyRows.map((c) => ({ id: c.id, name: c.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [companyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.loan.client.toLowerCase().includes(q) ||
        r.loan.ref.toLowerCase().includes(q) ||
        (r.companyName?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <p className="text-muted2 text-[13px]">Read-only view of loans across all companies.</p>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[13px] text-red">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
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
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Search</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, ref, company…"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-muted2 text-[13px]">Loading loans…</p>
      ) : (
        <div className="panel-surface overflow-x-auto">
          <table className="w-full border-collapse text-[13px] min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
                <th className="text-left font-normal px-4 py-2.5">Company</th>
                <th className="text-left font-normal px-4 py-2.5">Client</th>
                <th className="text-left font-normal px-4 py-2.5">Ref</th>
                <th className="text-right font-normal px-4 py-2.5">Total</th>
                <th className="text-right font-normal px-4 py-2.5">Remaining</th>
                <th className="text-left font-normal px-4 py-2.5">Start</th>
                <th className="text-center font-normal px-4 py-2.5 w-20">Paid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ loan, companyName }) => (
                <tr key={loan.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 text-[12px] text-muted2">{companyName ?? '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">{loan.client}</td>
                  <td className="px-4 py-2.5 text-muted2">{loan.ref || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(loan.total + loan.factoringFee)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(getLoanRemaining(loan))}</td>
                  <td className="px-4 py-2.5 text-muted2 tabular-nums">{fmtDate(loan.startDate)}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted2">
                    {loan.paidCount}/{loan.totalInstallments}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-muted2 text-[13px] py-8 text-center">No loans match filters.</p>
          )}
        </div>
      )}
    </div>
  );
}

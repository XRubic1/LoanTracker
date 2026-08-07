import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllLoansForAdmin,
  fetchCompaniesForAdmin,
  type AdminLoanRow,
} from '@/lib/supabase-db';
import { fmt, getLoanBasePerInstallment, getLoanFeePerInstallment } from '@/lib/utils';

/** Local calendar date as YYYY-MM-DD. */
function todayDateOnly(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** One installment closed/deducted on a specific date. */
interface DeductionRow {
  key: string;
  loanId: number;
  client: string;
  ref: string;
  installmentIndex: number;
  totalInstallments: number;
  amount: number;
  note: string;
  companyName: string | null;
  paidDate: string;
}

/**
 * Build deduction rows for installments whose paymentDates entry matches `date`.
 */
function buildDeductionsForDate(rows: AdminLoanRow[], date: string): DeductionRow[] {
  const out: DeductionRow[] = [];
  for (const { loan, companyName } of rows) {
    const dates = loan.paymentDates ?? [];
    for (let i = 0; i < dates.length; i++) {
      const paid = (dates[i] ?? '').trim();
      if (!paid || paid !== date) continue;
      const computed =
        getLoanBasePerInstallment(loan) + getLoanFeePerInstallment(loan);
      const amount = computed > 0 ? computed : loan.installment;
      out.push({
        key: `${loan.id}-${i}`,
        loanId: loan.id,
        client: loan.client,
        ref: loan.ref || '—',
        installmentIndex: i,
        totalInstallments: loan.totalInstallments,
        amount,
        note: (loan.paymentNotes?.[i] ?? '').trim(),
        companyName,
        paidDate: paid,
      });
    }
  }
  return out.sort((a, b) => {
    const team = (a.companyName ?? '').localeCompare(b.companyName ?? '');
    if (team !== 0) return team;
    const client = a.client.localeCompare(b.client);
    if (client !== 0) return client;
    return a.installmentIndex - b.installmentIndex;
  });
}

/**
 * Platform view of installments deducted on a chosen date (defaults to today).
 */
export function DeductedInstallmentsTab() {
  const [rows, setRows] = useState<AdminLoanRow[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [date, setDate] = useState(todayDateOnly);
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

  const deductions = useMemo(() => buildDeductionsForDate(rows, date), [rows, date]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deductions;
    return deductions.filter(
      (r) =>
        r.client.toLowerCase().includes(q) ||
        r.ref.toLowerCase().includes(q) ||
        (r.companyName?.toLowerCase().includes(q) ?? false) ||
        r.note.toLowerCase().includes(q)
    );
  }, [deductions, search]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + r.amount, 0),
    [filtered]
  );

  const isToday = date === todayDateOnly();

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {error && (
        <div className="flex-shrink-0 rounded border border-red/30 bg-red/5 px-3 py-1.5 text-[12px] text-red">
          {error}
        </div>
      )}

      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-muted2" htmlFor="deduction-date">
            Date
          </label>
          <input
            id="deduction-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayDateOnly())}
            className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
          />
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayDateOnly())}
              className="filter-btn"
            >
              Today
            </button>
          )}
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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Client, loan #, team…"
          className="flex-1 min-w-[140px] rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
        />
        {!loading && (
          <span className="text-[11px] text-muted2 tabular-nums">
            <span className="text-ink font-medium">{filtered.length}</span> deducted
            {filtered.length > 0 && (
              <>
                {' · '}
                <span className="text-ink font-medium">{fmt(totalAmount)}</span>
              </>
            )}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[12px] py-6 text-center">Loading deductions…</p>
      ) : filtered.length === 0 ? (
        <div className="panel-surface flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-muted2 text-[12px]">
            No installments deducted on {isToday ? 'today' : date}.
          </p>
        </div>
      ) : (
        <div className="panel-surface flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll">
            <table className="w-full border-collapse text-[12px] min-w-[720px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-3 py-1.5">Client</th>
                  <th className="text-left font-normal px-3 py-1.5">Loan #</th>
                  <th className="text-center font-normal px-3 py-1.5">Installment</th>
                  <th className="text-right font-normal px-3 py-1.5">Amount</th>
                  <th className="text-left font-normal px-3 py-1.5">Team</th>
                  <th className="text-left font-normal px-3 py-1.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-b-0 row-hover">
                    <td className="px-3 py-1 font-medium text-ink">{r.client}</td>
                    <td className="px-3 py-1 text-muted2 tabular-nums font-mono text-[11px]">
                      {r.ref}
                    </td>
                    <td className="px-3 py-1 text-center tabular-nums">
                      <span className="text-ink font-medium">{r.installmentIndex + 1}</span>
                      <span className="text-muted2 text-[10px]">/{r.totalInstallments}</span>
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums font-medium text-ink">
                      {fmt(r.amount)}
                    </td>
                    <td className="px-3 py-1 text-muted2">{r.companyName ?? 'Unassigned'}</td>
                    <td className="px-3 py-1 text-muted2 max-w-[220px] truncate" title={r.note}>
                      {r.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

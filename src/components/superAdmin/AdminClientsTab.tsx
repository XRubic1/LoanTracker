import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllClientInsuranceForAdmin,
  fetchAllLoansForAdmin,
  fetchCompaniesForAdmin,
  type AdminInsuranceRow,
  type AdminLoanRow,
} from '@/lib/supabase-db';
import {
  getClientInsuranceStatusLabel,
  isClientInsuranceCancellationWithDate,
} from '@/lib/clientInsuranceUtils';
import {
  fmt,
  fmtDate,
  getLoanOverdueCount,
  getLoanOverdueStatusLabel,
  getLoanProviderDisplay,
  getLoanRemaining,
  isDueThisWeek,
} from '@/lib/utils';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import type { Loan } from '@/types';

type ViewFilter = 'all' | 'risky';

/** Normalize client name for joining loans / insurance / registry. */
function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isLoanClosed(loan: Loan): boolean {
  return loan.paidCount >= loan.totalInstallments;
}

function isInsuranceRisky(row: AdminInsuranceRow): boolean {
  const s = (row.insurance.status ?? '').trim().toLowerCase();
  if (s === 'inactive' || s === 'out') return true;
  if (s.includes('cancellation') || s.includes('cancelled') || s.includes('canceled')) return true;
  return isClientInsuranceCancellationWithDate(row.insurance);
}

/** Status badge for a loan in the client detail modal. */
function getLoanStatus(loan: Loan): {
  variant: 'due' | 'overdue' | 'ok' | 'closed';
  label: string;
} {
  if (isLoanClosed(loan)) return { variant: 'closed', label: 'Closed' };
  try {
    const overdueLabel = getLoanOverdueStatusLabel(loan);
    if (overdueLabel) {
      return { variant: 'overdue', label: overdueLabel };
    }
    if (isDueThisWeek(loan)) return { variant: 'due', label: 'Open' };
  } catch {
    // ignore
  }
  return { variant: 'ok', label: 'Pending' };
}

interface ClientLoanSummary {
  key: string;
  clientName: string;
  companyName: string | null;
  companyId: number | null;
  totalLoans: number;
  openLoans: number;
  closedLoans: number;
  outstanding: number;
  overdueLoans: number;
  /** Worst overdue depth in weeks (installments past grace). */
  maxOverdueWeeks: number;
  risks: string[];
  insuranceLabel: string | null;
}

/** Prefer same-team match, then any team with the same client name. */
function findByClientName<T extends { companyId: number | null }>(
  items: T[],
  companyId: number | null,
  name: string,
  getName: (item: T) => string
): T | undefined {
  const n = normName(name);
  const sameTeam = items.find(
    (item) => item.companyId === companyId && normName(getName(item)) === n
  );
  if (sameTeam) return sameTeam;
  return items.find((item) => normName(getName(item)) === n);
}

/**
 * Build per-client loan + risk summaries for clients that have (or had) loans.
 * Risk = overdue loans or insurance cancellation/inactive (not user notes).
 */
function buildClientSummaries(
  loans: AdminLoanRow[],
  insurance: AdminInsuranceRow[]
): ClientLoanSummary[] {
  const map = new Map<string, ClientLoanSummary>();

  const ensure = (clientName: string, companyId: number | null, companyName: string | null) => {
    const key = `${companyId ?? 'x'}|${normName(clientName)}`;
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        clientName,
        companyName,
        companyId,
        totalLoans: 0,
        openLoans: 0,
        closedLoans: 0,
        outstanding: 0,
        overdueLoans: 0,
        maxOverdueWeeks: 0,
        risks: [],
        insuranceLabel: null,
      };
      map.set(key, row);
    }
    return row;
  };

  for (const { loan, companyId, companyName } of loans) {
    const row = ensure(loan.client, companyId, companyName);
    row.totalLoans += 1;
    if (isLoanClosed(loan)) {
      row.closedLoans += 1;
    } else {
      row.openLoans += 1;
      row.outstanding += getLoanRemaining(loan);
      try {
        const weeks = getLoanOverdueCount(loan);
        if (weeks > 0) {
          row.overdueLoans += 1;
          if (weeks > row.maxOverdueWeeks) row.maxOverdueWeeks = weeks;
        }
      } catch {
        // skip bad schedule
      }
    }
  }

  const withLoans = [...map.values()].filter((r) => r.totalLoans > 0);

  for (const row of withLoans) {
    const risks: string[] = [];
    if (row.maxOverdueWeeks > 0) {
      risks.push(
        row.maxOverdueWeeks === 1 ? 'Due 1 week' : `Due ${row.maxOverdueWeeks} weeks`
      );
    }

    const ins = findByClientName(
      insurance,
      row.companyId,
      row.clientName,
      (i) => i.insurance.client
    );
    if (ins) {
      row.insuranceLabel = getClientInsuranceStatusLabel(ins.insurance);
      if (isInsuranceRisky(ins)) {
        const label = getClientInsuranceStatusLabel(ins.insurance);
        risks.push(label === '—' ? 'Insurance risk' : `Insurance: ${label}`);
      }
    }

    row.risks = risks;
  }

  return withLoans.sort((a, b) => {
    const aRisk = a.risks.length > 0 ? 0 : 1;
    const bRisk = b.risks.length > 0 ? 0 : 1;
    if (aRisk !== bRisk) return aRisk - bRisk;
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
    return a.clientName.localeCompare(b.clientName);
  });
}

/**
 * Super Admin view: clients who have had loans, loan counts, and risk signals.
 */
export function AdminClientsTab() {
  const [loans, setLoans] = useState<AdminLoanRow[]>([]);
  const [insurance, setInsurance] = useState<AdminInsuranceRow[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClientLoanSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyId = companyFilter === 'all' ? null : companyFilter;
      const [loanRows, insuranceRows, companyRows] = await Promise.all([
        fetchAllLoansForAdmin(companyId),
        fetchAllClientInsuranceForAdmin(companyId),
        fetchCompaniesForAdmin(),
      ]);
      setLoans(loanRows);
      setInsurance(insuranceRows);
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

  const summaries = useMemo(
    () => buildClientSummaries(loans, insurance),
    [loans, insurance]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter((r) => {
      if (viewFilter === 'risky' && r.risks.length === 0) return false;
      if (!q) return true;
      return (
        r.clientName.toLowerCase().includes(q) ||
        (r.companyName?.toLowerCase().includes(q) ?? false) ||
        r.risks.some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [summaries, search, viewFilter]);

  const stats = useMemo(() => {
    const risky = summaries.filter((r) => r.risks.length > 0).length;
    const openLoans = summaries.reduce((s, r) => s + r.openLoans, 0);
    const outstanding = summaries.reduce((s, r) => s + r.outstanding, 0);
    return { clients: summaries.length, risky, openLoans, outstanding };
  }, [summaries]);

  /** Loans for the selected client (same team + name), newest first. */
  const selectedLoans = useMemo(() => {
    if (!selected) return [];
    return loans
      .filter(
        (r) =>
          r.companyId === selected.companyId &&
          normName(r.loan.client) === normName(selected.clientName)
      )
      .sort((a, b) => {
        const aStart = a.loan.startDate || '';
        const bStart = b.loan.startDate || '';
        if (aStart !== bStart) return bStart.localeCompare(aStart);
        return Number(b.loan.id) - Number(a.loan.id);
      });
  }, [loans, selected]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {error && (
        <div className="flex-shrink-0 rounded border border-red/30 bg-red/5 px-3 py-1.5 text-[12px] text-red">
          {error}
        </div>
      )}

      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
        {!loading && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted2 tabular-nums">
            <span>
              <span className="text-ink font-medium">{stats.clients}</span> with loans
            </span>
            <span className={stats.risky > 0 ? 'text-red' : undefined}>
              <span className="font-medium">{stats.risky}</span> risky
            </span>
            <span>
              <span className="text-ink font-medium">{stats.openLoans}</span> open
            </span>
            <span>
              <span className="text-ink font-medium">{fmt(stats.outstanding)}</span> out
            </span>
          </div>
        )}
        <div className="flex gap-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'risky', label: 'Risky' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setViewFilter(opt.id)}
              className={`filter-btn ${viewFilter === opt.id ? 'filter-btn-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
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
          placeholder="Client, team, risk…"
          className="flex-1 min-w-[140px] rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
        />
        {!loading && (
          <span className="text-[11px] text-muted2">{filtered.length} shown</span>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[12px] py-6 text-center">Loading clients…</p>
      ) : filtered.length === 0 ? (
        <div className="panel-surface flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-muted2 text-[12px]">
            {viewFilter === 'risky'
              ? 'No risky clients with loans.'
              : 'No clients with loans match filters.'}
          </p>
        </div>
      ) : (
        <div className="panel-surface flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll">
            <table className="w-full border-collapse text-[12px] min-w-[800px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-3 py-1.5">Client</th>
                  <th className="text-center font-normal px-3 py-1.5">Loans</th>
                  <th className="text-center font-normal px-3 py-1.5">Open</th>
                  <th className="text-right font-normal px-3 py-1.5">Outstanding</th>
                  <th className="text-left font-normal px-3 py-1.5">Team</th>
                  <th className="text-left font-normal px-3 py-1.5">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-border last:border-b-0 row-hover cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-3 py-1 font-medium text-ink text-accent hover:underline">
                      {r.clientName}
                    </td>
                    <td className="px-3 py-1 text-center tabular-nums text-ink font-medium">
                      {r.totalLoans}
                    </td>
                    <td className="px-3 py-1 text-center tabular-nums text-muted2">
                      {r.openLoans}
                      <span className="text-[10px]">/{r.totalLoans}</span>
                    </td>
                    <td
                      className={`px-3 py-1 text-right tabular-nums font-medium ${
                        r.outstanding > 0 ? 'text-ink' : 'text-muted2'
                      }`}
                    >
                      {fmt(r.outstanding)}
                    </td>
                    <td className="px-3 py-1 text-muted2">{r.companyName ?? 'Unassigned'}</td>
                    <td className="px-3 py-1">
                      {r.risks.length === 0 ? (
                        <span className="text-muted2">—</span>
                      ) : (
                        <span className="text-red text-[11px]">{r.risks.join(' · ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `${selected.clientName}${selected.companyName ? ` · ${selected.companyName}` : ''}`
            : 'Client loans'
        }
        panelClassName="panel-surface rounded-xl p-5 w-[820px] max-w-[95vw] max-h-[85vh] flex flex-col"
      >
        {selected && (
          <>
            <p className="text-[11px] text-muted2 mb-3 tabular-nums">
              {selected.totalLoans} loan{selected.totalLoans === 1 ? '' : 's'}
              {' · '}
              {selected.openLoans} open
              {' · '}
              <span className={selected.outstanding > 0 ? 'text-ink' : undefined}>
                {fmt(selected.outstanding)} outstanding
              </span>
            </p>
            <div className="overflow-auto admin-table-scroll min-h-0 flex-1 -mx-1">
              <table className="w-full border-collapse text-[12px] min-w-[700px]">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                    <th className="text-left font-normal px-3 py-1.5">Loan #</th>
                    <th className="text-left font-normal px-3 py-1.5">Provider</th>
                    <th className="text-left font-normal px-3 py-1.5">Given out</th>
                    <th className="text-right font-normal px-3 py-1.5">Installment</th>
                    <th className="text-right font-normal px-3 py-1.5">Balance</th>
                    <th className="text-center font-normal px-3 py-1.5">Deducted</th>
                    <th className="text-left font-normal px-3 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLoans.map(({ loan }) => {
                    const status = getLoanStatus(loan);
                    const remaining = getLoanRemaining(loan);
                    return (
                      <tr
                        key={loan.id}
                        className="border-b border-border last:border-b-0 row-hover"
                      >
                        <td className="px-3 py-1.5 text-muted2 tabular-nums font-mono text-[11px]">
                          {loan.ref || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-muted2">
                          {getLoanProviderDisplay(loan)}
                        </td>
                        <td
                          className="px-3 py-1.5 tabular-nums text-ink"
                          title="First installment / loan start date"
                        >
                          {fmtDate(loan.startDate)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                          {fmt(loan.installment)}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                            remaining > 0 ? 'text-ink' : 'text-muted2'
                          }`}
                        >
                          {fmt(remaining)}
                        </td>
                        <td className="px-3 py-1.5 text-center tabular-nums">
                          <span className="text-ink font-medium">{loan.paidCount}</span>
                          <span className="text-muted2">/{loan.totalInstallments}</span>
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
              >
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

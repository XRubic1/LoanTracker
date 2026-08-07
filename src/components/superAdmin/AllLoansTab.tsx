import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAllLoansForAdmin, fetchCompaniesForAdmin } from '@/lib/supabase-db';
import type { AdminLoanRow } from '@/lib/supabase-db';
import type { Loan } from '@/types';
import { Badge } from '@/components/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { fetchIsPlatformAdmin, isPlatformAdminEnv } from '@/lib/platformAdmin';
import {
  fmt,
  getLoanRemaining,
  getLoanEffectiveTotal,
  getLoanProviderDisplay,
  getNextDueDate,
  getLoanOverdueCount,
  getLoanOverdueStatusLabel,
  isDueThisWeek,
} from '@/lib/utils';

type StatusFilter = 'open' | 'closed' | 'all';

function isLoanClosed(loan: Loan): boolean {
  return loan.paidCount >= loan.totalInstallments;
}

/**
 * Status for Super Admin — ignore team "hidden" flag; show real schedule status.
 */
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
    // Bad/missing schedule dates — still list the loan.
  }
  return { variant: 'ok', label: 'Pending' };
}

/** Urgency rank for sorting (lower = more urgent). */
function statusRank(loan: Loan): number {
  if (isLoanClosed(loan)) return 3;
  try {
    if (getLoanOverdueCount(loan) > 0) return 0;
    if (isDueThisWeek(loan)) return 1;
  } catch {
    return 2;
  }
  return 2;
}

/**
 * Platform-wide loans dashboard: compact flat table that fills the viewport.
 */
export function AllLoansTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminLoanRow[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True when JWT/email is in platform_admins (required for RLS to return all loans). */
  const [dbPlatformAdmin, setDbPlatformAdmin] = useState<boolean | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [loanRows, companyRows, isDbAdmin] = await Promise.all([
        fetchAllLoansForAdmin(companyFilter === 'all' ? null : companyFilter),
        fetchCompaniesForAdmin(),
        fetchIsPlatformAdmin(),
      ]);
      setRows(loanRows);
      setCompanies(companyRows.map((c) => ({ id: c.id, name: c.name })));
      setDbPlatformAdmin(isDbAdmin);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : String(err));
      } else {
        console.warn('All loans silent refresh failed:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates when any loan is created, closed, or edited — no page refresh needed
  const loadRef = useRef(load);
  loadRef.current = load;
  const silentRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const scheduleRefresh = () => {
      if (silentRefreshTimer.current) clearTimeout(silentRefreshTimer.current);
      silentRefreshTimer.current = setTimeout(() => {
        silentRefreshTimer.current = null;
        void loadRef.current({ silent: true });
      }, 250);
    };

    const channel = supabase
      .channel('admin-all-loans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, scheduleRefresh)
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('All loans realtime issue:', status, err);
        }
      });

    return () => {
      if (silentRefreshTimer.current) clearTimeout(silentRefreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const closed = isLoanClosed(r.loan);
      // Include team-hidden loans; Super Admin ignores the hidden flag for display
      if (statusFilter === 'open' && closed) return false;
      if (statusFilter === 'closed' && !closed) return false;
      if (!q) return true;
      return (
        r.loan.client.toLowerCase().includes(q) ||
        r.loan.ref.toLowerCase().includes(q) ||
        (r.companyName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, statusFilter]);

  /** Urgent-first sort so overdue/due loans surface at the top. */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const rank = statusRank(a.loan) - statusRank(b.loan);
      if (rank !== 0) return rank;
      try {
        const aDue = getNextDueDate(a.loan)?.getTime() ?? Infinity;
        const bDue = getNextDueDate(b.loan)?.getTime() ?? Infinity;
        if (aDue !== bDue) return aDue - bDue;
      } catch {
        // fall through
      }
      return a.loan.client.localeCompare(b.loan.client);
    });
  }, [filtered]);

  const summary = useMemo(() => {
    let openCount = 0;
    let closedCount = 0;
    let outstanding = 0;
    let portfolio = 0;
    let overdueLoans = 0;
    let dueThisWeek = 0;
    let dueThisWeekAmount = 0;

    for (const { loan } of rows) {
      portfolio += getLoanEffectiveTotal(loan);
      if (isLoanClosed(loan)) {
        closedCount += 1;
        continue;
      }
      openCount += 1;
      outstanding += getLoanRemaining(loan);
      try {
        if (getLoanOverdueCount(loan) > 0) overdueLoans += 1;
        else if (isDueThisWeek(loan)) {
          dueThisWeek += 1;
          dueThisWeekAmount += loan.installment;
        }
      } catch {
        // skip bad schedule for stats
      }
    }

    return {
      openCount,
      closedCount,
      outstanding,
      portfolio,
      overdueLoans,
      dueThisWeek,
      dueThisWeekAmount,
      totalLoans: rows.length,
    };
  }, [rows]);

  const envOnlyAdmin = dbPlatformAdmin === false && isPlatformAdminEnv(user?.email);

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {error && (
        <div className="flex-shrink-0 rounded border border-red/30 bg-red/5 px-3 py-1.5 text-[12px] text-red">
          {error}
        </div>
      )}

      {envOnlyAdmin && (
        <div className="flex-shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-ink">
          <p className="font-medium mb-0.5">Database access not granted</p>
          <p className="text-muted2 text-[11px]">
            Add your email to <code className="text-ink">platform_admins</code>, then sign out/in.
          </p>
        </div>
      )}

      {/* Portfolio strip */}
      {!loading && (
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Portfolio</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink truncate">
              {fmt(summary.portfolio)}
            </div>
            <div className="text-[10px] text-muted2 mt-1">
              {summary.totalLoans} loan{summary.totalLoans === 1 ? '' : 's'} funded
            </div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Open balance</div>
            <div className="text-[16px] font-medium leading-none tabular-nums text-ink truncate">
              {fmt(summary.outstanding)}
            </div>
            <div className="text-[10px] text-muted2 mt-1">
              {summary.openCount} open loan{summary.openCount === 1 ? '' : 's'}
            </div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Due this week</div>
            <div
              className={`text-[16px] font-medium leading-none tabular-nums truncate ${
                summary.dueThisWeek > 0 ? 'text-accent' : 'text-ink'
              }`}
            >
              {summary.dueThisWeek}
            </div>
            <div className="text-[10px] text-muted2 mt-1 tabular-nums">
              {summary.dueThisWeek > 0 ? `${fmt(summary.dueThisWeekAmount)} due` : 'none scheduled'}
            </div>
          </div>
          <div className="panel-surface px-3 py-2 min-w-0">
            <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">Risky loans</div>
            <div
              className={`text-[16px] font-medium leading-none tabular-nums truncate ${
                summary.overdueLoans > 0 ? 'text-red' : 'text-ink'
              }`}
            >
              {summary.overdueLoans}
            </div>
            <div className="text-[10px] text-muted2 mt-1">past grace</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex-shrink-0 flex flex-wrap gap-x-3 gap-y-1.5 items-center">
        <div className="flex gap-0.5">
          {(
            [
              { id: 'open', label: 'Open' },
              { id: 'closed', label: 'Closed' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`filter-btn ${statusFilter === opt.id ? 'filter-btn-active' : ''}`}
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
          placeholder="Client, loan #, team…"
          className="flex-1 min-w-[140px] rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
        />
        {!loading && (
          <span className="text-[11px] text-muted2">
            {sorted.length}
            {statusFilter === 'open' && summary.closedCount > 0
              ? ` · ${summary.closedCount} closed`
              : ''}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[12px] py-6 text-center">Loading loans…</p>
      ) : sorted.length === 0 ? (
        <div className="panel-surface flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-muted2 text-[12px]">No loans match filters.</p>
        </div>
      ) : (
        <div className="panel-surface flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll">
            <table className="w-full border-collapse text-[12px] min-w-[860px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-3 py-1.5">Client</th>
                  <th className="text-left font-normal px-3 py-1.5">Loan #</th>
                  <th className="text-left font-normal px-3 py-1.5">Provider</th>
                  <th className="text-right font-normal px-3 py-1.5">Installment</th>
                  <th className="text-right font-normal px-3 py-1.5">Balance</th>
                  <th className="text-center font-normal px-3 py-1.5">Deducted</th>
                  <th className="text-left font-normal px-3 py-1.5">Team</th>
                  <th className="text-left font-normal px-3 py-1.5 w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ loan, companyName }) => {
                  const status = getLoanStatus(loan);
                  return (
                    <tr
                      key={loan.id}
                      className="border-b border-border last:border-b-0 row-hover"
                    >
                      <td className="px-3 py-1 font-medium text-ink">{loan.client}</td>
                      <td className="px-3 py-1 text-muted2 tabular-nums font-mono text-[11px]">
                        {loan.ref || '—'}
                      </td>
                      <td className="px-3 py-1 text-muted2">{getLoanProviderDisplay(loan)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-ink">
                        {fmt(loan.installment)}
                      </td>
                      <td className="px-3 py-1 text-right tabular-nums font-medium text-ink">
                        {fmt(getLoanRemaining(loan))}
                      </td>
                      <td
                        className="px-3 py-1 text-center tabular-nums"
                        title={`${loan.paidCount} deducted of ${loan.totalInstallments}`}
                      >
                        <span className="text-ink font-medium">{loan.paidCount}</span>
                        <span className="text-muted2">/{loan.totalInstallments}</span>
                      </td>
                      <td className="px-3 py-1 text-muted2">{companyName ?? 'Unassigned'}</td>
                      <td className="px-3 py-1">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

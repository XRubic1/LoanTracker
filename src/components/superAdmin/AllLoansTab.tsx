import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllLoansForAdmin, fetchCompaniesForAdmin } from '@/lib/supabase-db';
import type { AdminLoanRow } from '@/lib/supabase-db';
import type { Loan } from '@/types';
import { Badge } from '@/components/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { fetchIsPlatformAdmin, isPlatformAdminEnv } from '@/lib/platformAdmin';
import {
  fmt,
  fmtDate,
  getLoanRemaining,
  getNextDueDate,
  getLoanOverdueCount,
  isDueThisWeek,
} from '@/lib/utils';

/** Loans grouped under one team/company, split into open and closed. */
interface TeamGroup {
  key: string;
  name: string;
  open: AdminLoanRow[];
  closed: AdminLoanRow[];
}

function isLoanClosed(loan: Loan): boolean {
  return loan.paidCount >= loan.totalInstallments;
}

/**
 * Status for one loan. Overdue only counts installments whose grace period
 * (until the Monday after the due date) has passed — i.e. a whole week was
 * skipped. A payment due earlier in the current week is "due", not overdue.
 */
function getLoanStatus(loan: Loan): { variant: 'due' | 'overdue' | 'ok' | 'closed'; label: string } {
  if (isLoanClosed(loan)) return { variant: 'closed', label: 'Closed' };
  try {
    const overdueCount = getLoanOverdueCount(loan);
    if (overdueCount > 0) {
      return { variant: 'overdue', label: overdueCount > 1 ? `Overdue ×${overdueCount}` : 'Overdue' };
    }
    if (isDueThisWeek(loan)) return { variant: 'due', label: 'Due this week' };
  } catch {
    // Bad/missing schedule dates — still list the loan.
  }
  return { variant: 'ok', label: 'On track' };
}

/** Compact stat used in the per-team header strip. */
function TeamStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'red' | 'blue';
}) {
  const valueClass = tone === 'red' ? 'text-red' : tone === 'blue' ? 'text-accent' : 'text-ink';
  return (
    <div className="panel-surface px-3.5 py-2.5">
      <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-1">{label}</div>
      <div className={`text-[17px] font-medium leading-none tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  );
}

/** Shared table for a list of loans (open or closed). */
function LoanTable({ rows }: { rows: AdminLoanRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] min-w-[720px]">
        <thead>
          <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
            <th className="text-left font-normal px-4 py-2.5">Client</th>
            <th className="text-left font-normal px-4 py-2.5">Ref</th>
            <th className="text-right font-normal px-4 py-2.5">Total</th>
            <th className="text-right font-normal px-4 py-2.5">Remaining</th>
            <th className="text-left font-normal px-4 py-2.5">Next due</th>
            <th className="text-center font-normal px-4 py-2.5 w-20">Paid</th>
            <th className="text-left font-normal px-4 py-2.5 w-32">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ loan }) => {
            const status = getLoanStatus(loan);
            let nextDueLabel = '—';
            if (!isLoanClosed(loan)) {
              try {
                const nextDue = getNextDueDate(loan);
                if (nextDue) nextDueLabel = fmtDate(nextDue);
              } catch {
                nextDueLabel = '—';
              }
            }
            return (
              <tr key={loan.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 font-medium text-ink">{loan.client}</td>
                <td className="px-4 py-2.5 text-muted2">{loan.ref || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmt(loan.total + (loan.factoringFee ?? 0))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt(getLoanRemaining(loan))}</td>
                <td className="px-4 py-2.5 text-muted2 tabular-nums">{nextDueLabel}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-muted2">
                  {loan.paidCount}/{loan.totalInstallments}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One team section: quick stats + open loans + closed loans (both always visible). */
function TeamSection({ group }: { group: TeamGroup }) {
  const stats = useMemo(() => {
    const openLoans = group.open.map((r) => r.loan);
    let outstanding = 0;
    let overdueLoans = 0;
    let dueThisWeek = 0;
    for (const l of openLoans) {
      outstanding += getLoanRemaining(l);
      try {
        const overdue = getLoanOverdueCount(l);
        if (overdue > 0) overdueLoans += 1;
        else if (isDueThisWeek(l)) dueThisWeek += 1;
      } catch {
        // skip bad schedule for stats
      }
    }
    const totalFunded = [...group.open, ...group.closed].reduce(
      (sum, r) => sum + r.loan.total + (r.loan.factoringFee ?? 0),
      0
    );
    return { outstanding, overdueLoans, dueThisWeek, totalFunded };
  }, [group]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 pt-1">
        <h2 className="text-[14px] font-semibold text-ink">{group.name}</h2>
        <span className="count-badge">{group.open.length + group.closed.length}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <TeamStat
          label="Open loans"
          value={String(group.open.length)}
          sub={`${group.closed.length} closed`}
        />
        <TeamStat label="Outstanding" value={fmt(stats.outstanding)} sub="remaining on open loans" />
        <TeamStat label="Total funded" value={fmt(stats.totalFunded)} sub="all loans incl. fees" />
        <TeamStat
          label="Due this week"
          value={String(stats.dueThisWeek)}
          sub="payments this week"
          tone={stats.dueThisWeek > 0 ? 'blue' : undefined}
        />
        <TeamStat
          label="Overdue"
          value={String(stats.overdueLoans)}
          sub="week skipped"
          tone={stats.overdueLoans > 0 ? 'red' : undefined}
        />
      </div>

      {/* Open loans */}
      <div className="panel-surface">
        <div className="flex items-center justify-between px-4 py-[11px] border-b border-border">
          <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
            Open loans
          </span>
          <span className="count-badge">{group.open.length}</span>
        </div>
        {group.open.length > 0 ? (
          <LoanTable rows={group.open} />
        ) : (
          <p className="text-muted2 text-[13px] py-5 text-center">No open loans.</p>
        )}
      </div>

      {/* Closed loans — always shown, not collapsed */}
      <div className="panel-surface">
        <div className="flex items-center justify-between px-4 py-[11px] border-b border-border">
          <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
            Closed loans
          </span>
          <span className="count-badge">{group.closed.length}</span>
        </div>
        {group.closed.length > 0 ? (
          <LoanTable rows={group.closed} />
        ) : (
          <p className="text-muted2 text-[13px] py-5 text-center">No closed loans.</p>
        )}
      </div>
    </div>
  );
}

export function AllLoansTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminLoanRow[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True when JWT/email is in platform_admins (required for RLS to return all loans). */
  const [dbPlatformAdmin, setDbPlatformAdmin] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  // Group loans by team; open loans sorted urgent-first, closed by newest.
  const teamGroups = useMemo(() => {
    const map = new Map<string, TeamGroup>();
    for (const row of filtered) {
      const key = row.companyId != null ? String(row.companyId) : 'unassigned';
      let group = map.get(key);
      if (!group) {
        group = { key, name: row.companyName ?? 'Unassigned', open: [], closed: [] };
        map.set(key, group);
      }
      (isLoanClosed(row.loan) ? group.closed : group.open).push(row);
    }

    const statusRank = (loan: Loan) => {
      try {
        if (getLoanOverdueCount(loan) > 0) return 0;
        if (isDueThisWeek(loan)) return 1;
      } catch {
        return 2;
      }
      return 2;
    };

    for (const group of map.values()) {
      group.open.sort((a, b) => {
        const rank = statusRank(a.loan) - statusRank(b.loan);
        if (rank !== 0) return rank;
        try {
          const aDue = getNextDueDate(a.loan)?.getTime() ?? Infinity;
          const bDue = getNextDueDate(b.loan)?.getTime() ?? Infinity;
          return aDue - bDue;
        } catch {
          return 0;
        }
      });
      group.closed.sort((a, b) => Number(b.loan.id) - Number(a.loan.id));
    }

    return [...map.values()].sort((a, b) => {
      if (a.key === 'unassigned') return 1;
      if (b.key === 'unassigned') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const envOnlyAdmin =
    dbPlatformAdmin === false && isPlatformAdminEnv(user?.email);

  return (
    <div className="space-y-4">
      <p className="text-muted2 text-[13px]">
        Read-only view of loans across all companies, grouped by team. Loans show as overdue only
        when a payment week was skipped.
      </p>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[13px] text-red">
          {error}
        </div>
      )}

      {envOnlyAdmin && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-ink">
          <p className="font-medium mb-1">Super Admin UI only — database access not granted</p>
          <p className="text-muted2">
            Your email is in <code className="text-[12px] text-ink">VITE_PLATFORM_ADMIN_EMAILS</code>{' '}
            (nav access), but not in the <code className="text-[12px] text-ink">platform_admins</code>{' '}
            table. Row-level security will not return other teams&apos; loans until you add it. Run
            this in the Supabase SQL editor:
          </p>
          <pre className="mt-2 rounded-md bg-surface px-3 py-2 text-[12px] overflow-x-auto">
            {`INSERT INTO public.platform_admins (email)\nVALUES ('${(user?.email ?? 'you@example.com').toLowerCase()}')\nON CONFLICT DO NOTHING;`}
          </pre>
          <p className="text-muted2 mt-2">Then sign out and sign back in, and reload this tab.</p>
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
        {!loading && (
          <p className="text-[11px] text-muted2 pb-1.5">
            {filtered.length} loan{filtered.length === 1 ? '' : 's'}
            {search.trim() ? ' match' : ' loaded'}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[13px]">Loading loans…</p>
      ) : teamGroups.length === 0 ? (
        <div className="panel-surface px-4 py-8 text-center space-y-2">
          <p className="text-muted2 text-[13px]">No loans match filters.</p>
          {rows.length === 0 && !envOnlyAdmin && dbPlatformAdmin && (
            <p className="text-muted text-[12px]">
              Query returned 0 rows. Confirm loans exist for company owners in the database.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-7">
          {teamGroups.map((group) => (
            <TeamSection key={group.key} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

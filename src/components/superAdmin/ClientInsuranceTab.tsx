import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAllClientInsuranceForAdmin,
  fetchCompaniesForAdmin,
  type AdminInsuranceRow,
} from '@/lib/supabase-db';
import {
  getClientInsuranceStatusLabel,
  getDaysUntilCancellation,
  isClientInsuranceCancellationWithDate,
  resolveInsuranceCancellationDate,
} from '@/lib/clientInsuranceUtils';
import { fmtDate } from '@/lib/utils';

/** True when status is inactive (case-insensitive). */
function isInactive(status: string): boolean {
  return (status ?? '').trim().toLowerCase() === 'inactive';
}

/** True when insurance is a pending/scheduled cancellation. */
function isPendingCancellation(row: AdminInsuranceRow): boolean {
  const s = (row.insurance.status ?? '').trim().toLowerCase();
  if (s === 'inactive' || s === 'ok' || s === 'out') return false;
  return (
    s.includes('cancellation') ||
    s.includes('cancelled') ||
    s.includes('canceled') ||
    isClientInsuranceCancellationWithDate(row.insurance)
  );
}

/** Rows the Super Admin insurance tab should list. */
function isAlertInsurance(row: AdminInsuranceRow): boolean {
  return isInactive(row.insurance.status) || isPendingCancellation(row);
}

type KindFilter = 'all' | 'cancellation' | 'inactive';

/**
 * Platform view of clients whose insurance is inactive or pending cancellation.
 */
export function ClientInsuranceTab() {
  const [rows, setRows] = useState<AdminInsuranceRow[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [insuranceRows, companyRows] = await Promise.all([
        fetchAllClientInsuranceForAdmin(companyFilter === 'all' ? null : companyFilter),
        fetchCompaniesForAdmin(),
      ]);
      setRows(insuranceRows.filter(isAlertInsurance));
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
    return rows
      .filter((r) => {
        if (kindFilter === 'inactive') return isInactive(r.insurance.status);
        if (kindFilter === 'cancellation') return isPendingCancellation(r);
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        return (
          r.insurance.client.toLowerCase().includes(q) ||
          r.insurance.mc.toLowerCase().includes(q) ||
          r.insurance.dot.toLowerCase().includes(q) ||
          (r.companyName?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        // Cancellations first (soonest date), then inactive A–Z
        const aCancel = isPendingCancellation(a);
        const bCancel = isPendingCancellation(b);
        if (aCancel !== bCancel) return aCancel ? -1 : 1;
        if (aCancel && bCancel) {
          const aDays = getDaysUntilCancellation(a.insurance) ?? 9999;
          const bDays = getDaysUntilCancellation(b.insurance) ?? 9999;
          if (aDays !== bDays) return aDays - bDays;
        }
        return a.insurance.client.localeCompare(b.insurance.client);
      });
  }, [rows, search, kindFilter]);

  const counts = useMemo(() => {
    let cancellation = 0;
    let inactive = 0;
    for (const r of rows) {
      if (isInactive(r.insurance.status)) inactive += 1;
      else if (isPendingCancellation(r)) cancellation += 1;
    }
    return { cancellation, inactive, total: rows.length };
  }, [rows]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {error && (
        <div className="flex-shrink-0 rounded border border-red/30 bg-red/5 px-3 py-1.5 text-[12px] text-red">
          {error}
        </div>
      )}

      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
        <div className="flex gap-0.5">
          {(
            [
              { id: 'all', label: `All (${counts.total})` },
              { id: 'cancellation', label: `Cancellation (${counts.cancellation})` },
              { id: 'inactive', label: `Inactive (${counts.inactive})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKindFilter(opt.id)}
              className={`filter-btn ${kindFilter === opt.id ? 'filter-btn-active' : ''}`}
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
          placeholder="Client, MC, DOT, team…"
          className="flex-1 min-w-[160px] rounded border border-border bg-surface px-2 py-1 text-[12px] text-ink"
        />
        {!loading && (
          <span className="text-[11px] text-muted2">{filtered.length} shown</span>
        )}
      </div>

      {loading ? (
        <p className="text-muted2 text-[12px] py-6 text-center">Loading insurance…</p>
      ) : filtered.length === 0 ? (
        <div className="panel-surface flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-muted2 text-[12px]">
            No clients with pending cancellation or inactive insurance.
          </p>
        </div>
      ) : (
        <div className="panel-surface flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto admin-table-scroll">
            <table className="w-full border-collapse text-[12px] min-w-[700px]">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                  <th className="text-left font-normal px-3 py-1.5">Client</th>
                  <th className="text-left font-normal px-3 py-1.5">Status</th>
                  <th className="text-left font-normal px-3 py-1.5">Cancel date</th>
                  <th className="text-left font-normal px-3 py-1.5">MC</th>
                  <th className="text-left font-normal px-3 py-1.5">DOT</th>
                  <th className="text-left font-normal px-3 py-1.5">Team</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ insurance, companyName }) => {
                  const cancelDate = resolveInsuranceCancellationDate(insurance);
                  const daysUntil = getDaysUntilCancellation(insurance);
                  const inactive = isInactive(insurance.status);
                  return (
                    <tr
                      key={insurance.id}
                      className="border-b border-border last:border-b-0 row-hover"
                    >
                      <td className="px-3 py-1.5 font-medium text-ink">{insurance.client}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            inactive
                              ? 'text-muted2'
                              : daysUntil != null && daysUntil <= 7
                                ? 'text-red font-medium'
                                : 'text-ink'
                          }
                        >
                          {getClientInsuranceStatusLabel(insurance)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted2">
                        {cancelDate ? fmtDate(new Date(cancelDate + 'T12:00:00')) : '—'}
                        {daysUntil != null && daysUntil >= 0 && (
                          <span className="ml-1 text-[10px]">
                            ({daysUntil === 0 ? 'today' : `${daysUntil}d`})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted2 tabular-nums">{insurance.mc || '—'}</td>
                      <td className="px-3 py-1.5 text-muted2 tabular-nums">{insurance.dot || '—'}</td>
                      <td className="px-3 py-1.5 text-muted2">{companyName ?? 'Unassigned'}</td>
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

import { useState } from 'react';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import {
  fmt,
  fmtDate,
  getReserveNextDueDate,
  isReserveDueNow,
  isReserveDueThisWeek,
} from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';

interface ReservesPageProps
  extends Pick<UseDataResult, 'reserves' | 'markReservePaid' | 'removeReserve'> {
  runWithPasswordProtection: (action: () => void) => void;
  onOpenDetail: (id: number) => void;
  onAddReserve: () => void;
}

export function ReservesPage({
  reserves,
  markReservePaid: _markReservePaid, // provided but not used in this list view
  removeReserve: _removeReserve,
  runWithPasswordProtection: _runWithPasswordProtection,
  onOpenDetail,
  onAddReserve,
}: ReservesPageProps) {
  const [hideClosed, setHideClosed] = useState(true); // start with closed reserves hidden

  let list = [...reserves];
  // Optionally hide fully paid reserves in this list view (closed reserves are shown on the Closed tab instead)
  if (hideClosed) {
    list = list.filter((r) => r.paidCount < r.installments);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Reserves</h1>
        <button
          type="button"
          onClick={onAddReserve}
          className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium transition-colors hover:opacity-90"
        >
          + Add Reserve
        </button>
      </div>

      <div className="flex items-center justify-end mb-3">
        <button
          type="button"
          onClick={() => setHideClosed((v) => !v)}
          className={`toggle-chip ${hideClosed ? 'toggle-chip-active' : ''}`}
        >
          <span className="toggle-chip-box">{hideClosed ? '✓' : ''}</span>
          <span>Hide closed reserves</span>
        </button>
      </div>

      <Section title="Reserves">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Client
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Per Deduction
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border min-w-[100px]">
                Progress
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Next Due
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Last Deducted
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Status
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-muted text-[13px]">
                  No reserves
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const isClosed = r.paidCount >= r.installments;
                const nextDue = getReserveNextDueDate(r);
                const isDueNow = isReserveDueNow(r);
                const isDueThisWeek2 = isReserveDueThisWeek(r);
                const status = isClosed
                  ? <Badge variant="closed">Closed</Badge>
                  : isDueNow
                    ? <Badge variant="overdue">Due Now</Badge>
                    : isDueThisWeek2
                      ? <Badge variant="due">This Week</Badge>
                      : <Badge variant="ok">Pending</Badge>;
                const lastDeducted =
                  r.deductionDates?.length
                    ? fmtDate(r.deductionDates[r.deductionDates.length - 1])
                    : '—';
                const freq = r.freqDays ?? 7;
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer row-hover transition-colors"
                    onClick={() => onOpenDetail(r.id)}
                  >
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle">
                      <span className="font-medium text-ink">{r.client}</span>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle">
                      <span className="font-mono font-medium">{fmt(r.amount / r.installments)}</span>
                      <span className="text-[10px] text-muted block">per deduction</span>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle font-mono">
                      {r.paidCount}/{r.installments}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle">
                      <span className="font-mono text-[11px] text-muted2 block">{fmtDate(r.date)}</span>
                      <span className="text-[10px] text-muted block">every {freq}d</span>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle">
                      <span
                        className={`font-mono text-[11px] ${isDueNow ? 'text-yellow' : ''}`}
                      >
                        {nextDue && !isClosed ? fmtDate(nextDue) : '—'}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle font-mono text-[11px] text-muted2">
                      {lastDeducted}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle">{status}</td>
                    <td className="py-1.5 pr-2 border-b border-border/40 align-middle" />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Section>
    </>
  );
}

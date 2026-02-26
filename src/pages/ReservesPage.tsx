import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { CheckBox } from '@/components/CheckBox';
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
  onOpenDetail: (id: number) => void;
  onAddReserve: () => void;
}

function DelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-[26px] h-[26px] rounded-md border-0 bg-transparent text-muted flex items-center justify-center transition-colors hover:bg-red/10 hover:text-red"
    >
      <svg className="w-3.5 h-3.5 stroke-currentColor stroke-2 fill-none" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

export function ReservesPage({
  reserves,
  markReservePaid,
  removeReserve,
  onOpenDetail,
  onAddReserve,
}: ReservesPageProps) {
  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this reserve?')) return;
    removeReserve(id);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-semibold">Reserves</h1>
        <button
          type="button"
          onClick={onAddReserve}
          className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium transition-colors hover:bg-[#3a7de8]"
        >
          + Add Reserve
        </button>
      </div>

      <Section title="Reserves">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Client
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Per Deduction
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border min-w-[100px]">
                Progress
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Next Due
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Last Deducted
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Status
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {reserves.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted text-[13px]">
                  No reserves
                </td>
              </tr>
            ) : (
              reserves.map((r) => {
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
                    className="cursor-pointer hover:bg-white/[0.015] transition-colors"
                    onClick={() => onOpenDetail(r.id)}
                  >
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <span className="font-medium text-text">{r.client}</span>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <span className="font-mono font-medium">{fmt(r.amount / r.installments)}</span>
                      <span className="text-[10px] text-muted block">per deduction</span>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono">
                      {r.paidCount}/{r.installments}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <span className="font-mono text-[11px] text-muted2 block">{fmtDate(r.date)}</span>
                      <span className="text-[10px] text-muted block">every {freq}d</span>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <span
                        className={`font-mono text-[11px] ${isDueNow ? 'text-yellow' : ''}`}
                      >
                        {nextDue && !isClosed ? fmtDate(nextDue) : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-[11px] text-muted2">
                      {lastDeducted}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">{status}</td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <CheckBox
                          checked={isClosed}
                          onToggle={() => !isClosed && markReservePaid(r.id)}
                          disabled={isClosed}
                        />
                        <DelButton onClick={() => handleDelete(r.id)} />
                      </div>
                    </td>
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

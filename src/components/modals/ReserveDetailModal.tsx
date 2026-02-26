import type { Reserve } from '@/types';
import { Modal } from '@/components/Modal';
import { fmt, fmtDate } from '@/lib/utils';

interface ReserveDetailModalProps {
  reserve: Reserve | null;
  open: boolean;
  onClose: () => void;
  onMarkDeducted: () => void;
  onReverse: () => void;
  onDelete: () => void;
}

export function ReserveDetailModal({
  reserve,
  open,
  onClose,
  onMarkDeducted,
  onReverse,
  onDelete,
}: ReserveDetailModalProps) {
  if (!reserve) return null;

  const perInst = reserve.amount / reserve.installments;
  const remaining = perInst * (reserve.installments - reserve.paidCount);
  const isClosed = reserve.paidCount >= reserve.installments;
  const canReverse = reserve.paidCount > 0;
  const freq = reserve.freqDays ?? 7;

  const handleDelete = () => {
    if (!window.confirm('Delete this reserve?')) return;
    onDelete();
  };

  return (
    <Modal open={open} onClose={onClose} title={`${reserve.client} — Reserve`}>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Total Amount</span>
          <span className="font-mono font-medium">{fmt(reserve.amount)}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Per Deduction</span>
          <span className="font-mono font-medium">{fmt(perInst)}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Installments</span>
          <span className="font-mono font-medium">{reserve.installments}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Deducted</span>
          <span className="font-mono font-medium text-green">{reserve.paidCount}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Start Date</span>
          <span className="font-mono font-medium">{fmtDate(reserve.date)}</span>
        </div>
        {reserve.note && (
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Note</span>
            <span className="text-xs text-yellow">{reserve.note}</span>
          </div>
        )}

        <div className="text-[11px] text-muted uppercase tracking-wider mt-4 mb-2">
          Deductions
        </div>
        <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollable">
          {Array.from({ length: reserve.installments }, (_, i) => {
            const paid = i < reserve.paidCount;
            const isNext = i === reserve.paidCount;
            const scheduledDate = new Date(reserve.date);
            scheduledDate.setDate(scheduledDate.getDate() + i * freq);
            const actualDate =
              reserve.deductionDates?.[i] ? fmtDate(reserve.deductionDates[i]) : null;
            return (
              <div
                key={i}
                className={`flex items-center justify-between py-2.5 px-3.5 rounded-[10px] bg-surface text-[13px] ${paid ? 'opacity-50' : ''}`}
              >
                <span className="text-muted2 text-[11px]">
                  #{i + 1} · {fmtDate(scheduledDate)}
                  {actualDate && (
                    <span className="text-green ml-1">→ deducted {actualDate}</span>
                  )}
                </span>
                <span className="font-mono">{fmt(perInst)}</span>
                <span
                  className={`text-[11px] ${paid ? 'text-green' : isNext ? 'text-yellow' : 'text-muted'}`}
                >
                  {paid ? '✓ Deducted' : isNext ? '← Next' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center py-3 px-3.5 bg-surface rounded-[10px] text-[13px] mt-1">
          <span className="text-muted2">Remaining</span>
          <span className="font-mono font-semibold text-accent2">{fmt(remaining)}</span>
        </div>

        <div className="flex gap-2.5 justify-end mt-5">
          <button
            type="button"
            onClick={handleDelete}
            className="py-1.5 px-3.5 rounded-lg border border-red/30 text-red text-xs font-medium bg-transparent hover:bg-red/10"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onReverse}
            disabled={!canReverse}
            className="py-1.5 px-3.5 rounded-lg border border-yellow/30 text-yellow text-xs font-medium bg-transparent hover:bg-yellow/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↩ Reverse
          </button>
          <button
            type="button"
            onClick={onMarkDeducted}
            disabled={isClosed}
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClosed ? 'Fully Deducted' : '✓ Mark Deducted'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

import type { Loan } from '@/types';
import { Modal } from '@/components/Modal';
import { fmt, fmtDate, getLoanRemaining } from '@/lib/utils';

interface LoanDetailModalProps {
  loan: Loan | null;
  open: boolean;
  onClose: () => void;
  onMarkPaid: () => void;
  onReverse: () => void;
  onDelete: () => void;
}

export function LoanDetailModal({
  loan,
  open,
  onClose,
  onMarkPaid,
  onReverse,
  onDelete,
}: LoanDetailModalProps) {
  if (!loan) return null;

  const remaining = getLoanRemaining(loan);
  const isFullyPaid = loan.paidCount >= loan.totalInstallments;
  const canReverse = loan.paidCount > 0;

  const handleDelete = () => {
    if (!window.confirm('Delete this loan?')) return;
    onDelete();
  };

  return (
    <Modal open={open} onClose={onClose} title={`${loan.client} — ${loan.ref}`}>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Total Loan</span>
          <span className="font-mono font-medium">{fmt(loan.total)}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Installment</span>
          <span className="font-mono font-medium">{fmt(loan.installment)}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Total Installments</span>
          <span className="font-mono font-medium">{loan.totalInstallments}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Paid</span>
          <span className="font-mono font-medium text-green">{loan.paidCount}</span>
        </div>
        {loan.note && (
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Note</span>
            <span className="text-xs text-yellow">{loan.note}</span>
          </div>
        )}

        <div className="text-[11px] text-muted uppercase tracking-wider mt-4 mb-2">
          Installments
        </div>
        <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollable">
          {Array.from({ length: loan.totalInstallments }, (_, i) => {
            const paid = i < loan.paidCount;
            const isNext = i === loan.paidCount;
            const scheduledDate = new Date(loan.startDate);
            scheduledDate.setDate(scheduledDate.getDate() + i * loan.freqDays);
            const actualDate =
              loan.paymentDates?.[i] ? fmtDate(loan.paymentDates[i]) : null;
            return (
              <div
                key={i}
                className={`flex items-center justify-between py-2.5 px-3.5 rounded-[10px] bg-surface text-[13px] ${paid ? 'opacity-50' : ''}`}
              >
                <span className="text-muted2 text-[11px]">
                  #{i + 1} · {fmtDate(scheduledDate)}
                  {actualDate && (
                    <span className="text-green ml-1">→ paid {actualDate}</span>
                  )}
                </span>
                <span className="font-mono">{fmt(loan.installment)}</span>
                <span
                  className={`text-[11px] ${paid ? 'text-green' : isNext ? 'text-yellow' : 'text-muted'}`}
                >
                  {paid ? '✓ Paid' : isNext ? '← Next' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center py-3 px-3.5 bg-surface rounded-[10px] text-[13px]">
          <span className="text-muted2">Remaining Balance</span>
          <span className="font-mono font-semibold text-accent">{fmt(remaining)}</span>
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
            onClick={onMarkPaid}
            disabled={isFullyPaid}
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFullyPaid ? 'Fully Paid' : 'Mark Next Paid'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

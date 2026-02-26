import { useState, useEffect } from 'react';
import type { Loan } from '@/types';
import { Modal } from '@/components/Modal';
import { fmt, fmtDate, getLoanBasePerInstallment, getLoanFeePerInstallment } from '@/lib/utils';

/** Modal used on Overview: close only the next installment for a loan, with an optional note. */
interface CloseInstallmentModalProps {
  loan: Loan | null;
  open: boolean;
  onClose: () => void;
  /** Saves the note and marks the next installment paid in a single update (avoids race). */
  onCloseInstallment: (note: string) => Promise<void>;
}

export function CloseInstallmentModal({
  loan,
  open,
  onClose,
  onCloseInstallment,
}: CloseInstallmentModalProps) {
  const [note, setNote] = useState('');

  const index = loan ? loan.paidCount : 0;
  useEffect(() => {
    if (loan && open) {
      const notes = loan.paymentNotes ?? [];
      setNote(notes[index] ?? '');
    }
  }, [loan, index, open]);

  if (!loan) return null;

  const isFullyPaid = loan.paidCount >= loan.totalInstallments;
  const scheduledDate = new Date(loan.startDate);
  scheduledDate.setDate(scheduledDate.getDate() + index * loan.freqDays);
  const paidDate = loan.paymentDates?.[index];

  const handleCloseInstallment = async () => {
    await onCloseInstallment(note.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${loan.client} — Close installment`}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted2">
          Installment #{index + 1} of {loan.totalInstallments} · Scheduled {fmtDate(scheduledDate)}
          {paidDate && <span className="text-green ml-1"> · Paid {fmtDate(paidDate)}</span>}
        </p>
        <div className="py-2 border-b border-border text-[13px]">
          <div className="flex justify-between items-center">
            <span className="text-muted2">Amount</span>
            <span className="font-mono font-medium">{fmt(loan.installment)}</span>
          </div>
          {loan.factoringFee != null && loan.factoringFee > 0 && (
            <div className="mt-1.5 text-[12px] text-muted2 space-y-0.5">
              <div className="flex justify-between">
                <span>Base per installment</span>
                <span className="font-mono">{fmt(getLoanBasePerInstallment(loan))}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Factoring fee per installment</span>
                <span className="font-mono">+{fmt(getLoanFeePerInstallment(loan))} = {fmt(loan.installment)}</span>
              </div>
            </div>
          )}
        </div>
        <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
          Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)…"
          rows={3}
          className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-text placeholder:text-muted outline-none focus:border-accent resize-none"
        />
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCloseInstallment}
            disabled={isFullyPaid}
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close installment
          </button>
        </div>
      </div>
    </Modal>
  );
}

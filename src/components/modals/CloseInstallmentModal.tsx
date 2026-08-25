import { useState, useEffect } from 'react';
import type { Loan } from '@/types';
import { Modal } from '@/components/Modal';
import { InstallmentPaymentsList } from '@/components/InstallmentPaymentsList';
import { getInstallmentPayments } from '@/lib/loanPaymentActions';
import {
  fmt,
  fmtDate,
  getLoanBasePerInstallment,
  getLoanFeePerInstallment,
  getLoanInstallmentAmount,
  getLoanOpenInstallmentRemaining,
  scheduleDueDateToLocalDate,
} from '@/lib/utils';

/** Modal: post a payment toward the next open installment (partial, full, or overpay). */
interface CloseInstallmentModalProps {
  loan: Loan | null;
  open: boolean;
  onClose: () => void;
  /**
   * Posts paymentAmount toward the open installment.
   * paidDate is YYYY-MM-DD (default today). Parent should run buildPostInstallmentPayment.
   */
  onCloseInstallment: (note: string, paidDate: string, paymentAmount: number) => Promise<void>;
}

export function CloseInstallmentModal({
  loan,
  open,
  onClose,
  onCloseInstallment,
}: CloseInstallmentModalProps) {
  const [note, setNote] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const todayStr = () => new Date().toISOString().split('T')[0];
  const index = loan ? loan.paidCount : 0;

  useEffect(() => {
    if (loan && open) {
      // Always start blank — do not prefill with existing installment notes.
      // Those include auto "Partial $X on DATE" lines; resubmitting them
      // compounds notes on every payment.
      setNote('');
      setCloseDate(todayStr());
      setLocalError(null);
      const remaining = getLoanOpenInstallmentRemaining(loan);
      setAmountStr(remaining > 0 ? String(remaining) : String(loan.installment));
    }
  }, [loan, index, open]);

  if (!loan) return null;

  const alreadyPartial = Number(loan.partialPaidAmount ?? 0) || 0;
  const remainingDue = getLoanOpenInstallmentRemaining(loan);
  const creatingNextWeek = loan.paidCount >= loan.totalInstallments;
  const displayIndex = creatingNextWeek ? loan.totalInstallments : index;
  const scheduledDate = scheduleDueDateToLocalDate(
    loan.startDate,
    displayIndex,
    loan.freqDays ?? 7
  );
  const installmentDueLabel = creatingNextWeek
    ? loan.installment
    : getLoanInstallmentAmount(loan, index);

  const amountNum = amountStr.trim() ? parseFloat(amountStr) : NaN;
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const handlePostPayment = async () => {
    setLocalError(null);
    if (!amountValid) {
      setLocalError('Enter a payment amount greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      await onCloseInstallment(note.trim(), closeDate || todayStr(), amountNum);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${loan.client} — Post payment`}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted2">
          {creatingNextWeek ? (
            <>
              All {loan.totalInstallments} installments are deducted. Posting will create installment #
              {loan.totalInstallments + 1}.
            </>
          ) : (
            <>
              Installment #{index + 1} of {loan.totalInstallments} · Scheduled{' '}
              {fmtDate(scheduledDate)}
            </>
          )}
        </p>

        <div className="py-2 border-b border-border text-[13px] space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-muted2">Installment due</span>
            <span className="font-mono font-medium text-yellow">{fmt(installmentDueLabel)}</span>
          </div>
          {alreadyPartial > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted2">Already posted (partial)</span>
              <span className="font-mono text-green">{fmt(alreadyPartial)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted2">Remaining to close</span>
            <span className="font-mono font-medium text-accent">
              {fmt(creatingNextWeek ? loan.installment : remainingDue)}
            </span>
          </div>
          {loan.factoringFee != null && loan.factoringFee > 0 && (
            <div className="mt-1.5 text-[12px] text-muted2 space-y-0.5">
              <div className="flex justify-between">
                <span>Base per installment</span>
                <span className="font-mono">{fmt(getLoanBasePerInstallment(loan))}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Factoring fee per installment</span>
                <span className="font-mono">
                  +{fmt(getLoanFeePerInstallment(loan))} = {fmt(loan.installment)}
                </span>
              </div>
            </div>
          )}
        </div>

        {!creatingNextWeek && (
          <InstallmentPaymentsList
            payments={getInstallmentPayments(loan, index)}
            compact
          />
        )}

        <p className="text-[12px] text-muted2 leading-relaxed">
          Enter less than remaining to leave the installment open. Enter more than remaining to close
          it and apply the difference to the next installment.
        </p>

        <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
          Payment amount
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent mb-2 tabular-nums"
        />

        <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
          Payment date
        </label>
        <input
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent mb-2"
        />
        <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
          Note for this payment
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for this payment…"
          rows={2}
          className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink placeholder:text-muted outline-none focus:border-accent resize-none"
        />

        {localError && (
          <p className="text-[12px] text-red-400" role="alert">
            {localError}
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePostPayment()}
            disabled={submitting || !amountValid}
            className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting…' : amountValid && amountNum + 0.009 < remainingDue && !creatingNextWeek
              ? 'Post partial payment'
              : 'Post payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

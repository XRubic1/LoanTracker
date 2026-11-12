import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import type { Loan, LoanProviderType } from '@/types';
import { fmt, isWeekdayOnlySchedule, toNextWeekdayOnOrAfter } from '@/lib/utils';

interface EditLoanModalProps {
  open: boolean;
  loan: Loan | null;
  onClose: () => void;
  onSave: (loan: Loan) => Promise<Loan>;
}

const inputClass = 'form-input font-sans text-xs py-1.5 px-2.5';
const selectClass = 'select-field font-sans text-xs py-1.5 px-2.5';
const labelClass = 'block text-[11px] text-muted uppercase tracking-wider mb-1';

/** Correct a loan after it was entered. Posted payments are never changed. */
export function EditLoanModal({ open, loan, onClose, onSave }: EditLoanModalProps) {
  const [client, setClient] = useState('');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [providerType, setProviderType] = useState<LoanProviderType>('TruFunding');
  const [providerName, setProviderName] = useState('');
  const [factoringFee, setFactoringFee] = useState('');
  const [total, setTotal] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [freqDays, setFreqDays] = useState(7);
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !loan) return;
    setClient(loan.client);
    setRef(loan.ref);
    setNote(loan.note ?? '');
    setProviderType(loan.providerType);
    setProviderName(loan.providerName ?? '');
    setFactoringFee(loan.factoringFee ? String(loan.factoringFee) : '');
    setTotal(String(loan.total));
    setTotalInstallments(String(loan.totalInstallments));
    setFreqDays(loan.freqDays || 7);
    setStartDate(loan.startDate);
    setError(null);
  }, [open, loan]);

  if (!loan) return null;

  const hasPayments =
    loan.paidCount > 0 ||
    (Number(loan.partialPaidAmount ?? 0) || 0) > 0 ||
    (loan.installmentPayments ?? []).some((list) => (list?.length ?? 0) > 0);
  const hasUnevenAmounts = (loan.paymentAmounts ?? []).length > 0;
  /** The open installment (index = paidCount) must still exist. */
  const minInstallments = Math.max(1, loan.paidCount + ((Number(loan.partialPaidAmount ?? 0) || 0) > 0 ? 1 : 0));

  const totalNum = total.trim() ? parseFloat(total) : NaN;
  const countNum = totalInstallments.trim() ? parseInt(totalInstallments, 10) : 0;
  const feeNum = providerType === 'Other' && factoringFee.trim() ? parseFloat(factoringFee) || 0 : 0;
  const effectiveTotal = Number.isFinite(totalNum) ? totalNum + feeNum : 0;
  const installment = countNum > 0 && effectiveTotal > 0 ? effectiveTotal / countNum : 0;

  const amountsChange =
    Number.isFinite(totalNum) &&
    (totalNum !== loan.total || countNum !== loan.totalInstallments || feeNum !== (loan.factoringFee ?? 0));

  const save = async () => {
    setError(null);
    if (!client.trim()) return setError('Enter the client name.');
    if (!Number.isFinite(totalNum) || totalNum <= 0) return setError('Enter a total greater than 0.');
    if (!countNum || countNum < minInstallments) {
      return setError(
        hasPayments
          ? `This loan already has payments, so it needs at least ${minInstallments} installment${minInstallments === 1 ? '' : 's'}.`
          : 'Enter the number of installments.'
      );
    }
    if (!startDate) return setError('Pick a start date.');
    if (providerType === 'Other' && !providerName.trim()) return setError('Enter the provider name.');

    const scheduleFreq = freqDays || 7;
    const pad = <T,>(list: T[] | undefined, fill: T) =>
      Array.from({ length: countNum }, (_, i) => (list?.[i] !== undefined ? (list[i] as T) : fill));

    const updated: Loan = {
      ...loan,
      client: client.trim(),
      ref: ref.trim(),
      note: note.trim(),
      providerType,
      providerName: providerType === 'Other' ? providerName.trim() : '',
      factoringFee: feeNum,
      total: totalNum,
      installment,
      totalInstallments: countNum,
      freqDays: scheduleFreq,
      startDate: scheduleFreq === 1 ? toNextWeekdayOnOrAfter(startDate) : startDate,
      paymentNotes: pad(loan.paymentNotes, ''),
      installmentPayments: (loan.installmentPayments ?? []).slice(0, countNum),
      // Equal installments again when the amount or count changed; otherwise keep any uneven schedule.
      paymentAmounts: amountsChange ? [] : loan.paymentAmounts,
    };

    setSaving(true);
    try {
      await onSave(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={`Edit loan — ${loan.client}`}>
      <div className="space-y-3">
        {hasPayments && (
          <p className="text-[11px] text-yellow">
            {loan.paidCount} installment{loan.paidCount === 1 ? '' : 's'} already paid. Payments that were posted stay
            as they are; only the loan details and the schedule going forward change.
          </p>
        )}

        <div className="flex gap-2.5 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className={labelClass}>Client</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} className={`${inputClass} w-full`} />
          </div>
          <div className="w-[120px]">
            <label className={labelClass}>Ref</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className={`${inputClass} w-full`} />
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <label className="text-[11px] text-muted uppercase tracking-wider shrink-0">Provider</label>
          <select
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as LoanProviderType)}
            className={selectClass}
          >
            <option value="TruFunding">TruFunding</option>
            <option value="Other">Other</option>
          </select>
        </div>
        {providerType === 'Other' && (
          <div className="space-y-2 border-l-2 border-divider pl-3">
            <input
              placeholder="Provider (name)"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className={`${inputClass} w-full`}
            />
            <input
              type="number"
              placeholder="Factoring fee ($)"
              value={factoringFee}
              onChange={(e) => setFactoringFee(e.target.value)}
              min={0}
              step={0.01}
              className={`${inputClass} w-full`}
            />
          </div>
        )}

        <div className="flex gap-2.5 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className={labelClass}>Total amount</label>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              min={0}
              step={0.01}
              className={`${inputClass} w-full`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className={labelClass}># of installments</label>
            <input
              type="number"
              value={totalInstallments}
              onChange={(e) => setTotalInstallments(e.target.value)}
              min={minInstallments}
              className={`${inputClass} w-full`}
            />
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <span className="text-[11px] text-muted uppercase tracking-wider shrink-0">Installment</span>
          <span className="font-mono text-[13px] text-yellow">{installment > 0 ? fmt(installment) : '—'}</span>
        </div>
        {hasUnevenAmounts && amountsChange && (
          <p className="text-[11px] text-yellow">
            This loan has uneven installment amounts. Changing the total, fee or number of installments makes them all
            equal again.
          </p>
        )}

        <div className="flex gap-2.5 flex-wrap">
          <div className="w-[130px]">
            <label className={labelClass}>Every N days</label>
            <input
              type="number"
              value={freqDays}
              onChange={(e) => setFreqDays(parseInt(e.target.value, 10) || 7)}
              min={1}
              className={`${inputClass} w-full`}
              title={isWeekdayOnlySchedule(freqDays) ? '1 = every weekday (Mon–Fri)' : undefined}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className={labelClass}>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} w-full`} />
        </div>

        {error && (
          <p className="text-[12px] text-red" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2.5 justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

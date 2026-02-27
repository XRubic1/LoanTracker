import { useState } from 'react';
import { Modal } from '@/components/Modal';
import type { Loan, LoanProviderType } from '@/types';
import { fmt } from '@/lib/utils';

interface AddLoanModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: Omit<Loan, 'id'>) => Promise<Loan>;
}

const todayStr = new Date().toISOString().split('T')[0];

export function AddLoanModal({ open, onClose, onAdd }: AddLoanModalProps) {
  const [client, setClient] = useState('');
  const [ref, setRef] = useState('');
  const [total, setTotal] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [freqDays, setFreqDays] = useState(7);
  const [startDate, setStartDate] = useState(todayStr);
  const [providerType, setProviderType] = useState<LoanProviderType>('TruFunding');
  const [providerName, setProviderName] = useState('');
  const [factoringFee, setFactoringFee] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalNum = total.trim() ? parseFloat(total) : NaN;
  const totalInstNum = totalInstallments.trim() ? parseInt(totalInstallments, 10) : 0;
  const feeNum = factoringFee.trim() ? parseFloat(factoringFee) : 0;
  const effectiveTotal = !isNaN(totalNum) ? totalNum + (providerType === 'Other' ? feeNum : 0) : 0;
  const installmentAmount = totalInstNum > 0 && effectiveTotal > 0 ? effectiveTotal / totalInstNum : 0;

  const handleSubmit = async () => {
    if (
      !client.trim() ||
      !totalNum ||
      totalNum <= 0 ||
      !totalInstNum ||
      totalInstNum <= 0 ||
      !startDate
    ) {
      window.alert('Fill all required fields (Client, Total, # Installments, Start date)');
      return;
    }
    if (providerType === 'Other' && !providerName.trim()) {
      window.alert('Enter Provider name when Other is selected');
      return;
    }
    const fee = providerType === 'Other' ? (isNaN(feeNum) ? 0 : feeNum) : 0;
    const effective = totalNum + fee;
    const installment = totalInstNum > 0 ? effective / totalInstNum : 0;

    setSubmitting(true);
    try {
      await onAdd({
        client: client.trim(),
        ref: ref.trim(),
        total: totalNum,
        installment,
        paidCount: 0,
        totalInstallments: totalInstNum,
        startDate,
        freqDays: freqDays || 7,
        paymentDates: [],
        paymentNotes: [],
        note: '',
        providerType,
        providerName: providerType === 'Other' ? providerName.trim() : '',
        factoringFee: fee,
        hidden: false,
      });
      setClient('');
      setRef('');
      setTotal('');
      setTotalInstallments('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setFreqDays(7);
      setProviderType('TruFunding');
      setProviderName('');
      setFactoringFee('');
      onClose();
    } catch (err) {
      window.alert('Failed to add loan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Loan">
      <div className="space-y-3">
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Client Name"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="Ref (e.g. L530)"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="w-[120px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <label className="text-[11px] text-muted uppercase tracking-wider shrink-0">Provider</label>
          <select
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as LoanProviderType)}
            className="bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          >
            <option value="TruFunding">TruFunding</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {providerType === 'Other' && (
          <div className="space-y-2 pl-0 border-l-2 border-border/50 pl-3">
            <input
              type="text"
              placeholder="Provider (name)"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className="w-full bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
            />
            <input
              type="number"
              placeholder="Factoring fee ($)"
              value={factoringFee}
              onChange={(e) => setFactoringFee(e.target.value)}
              min={0}
              step={0.01}
              className="w-full bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
            />
            <p className="text-[11px] text-muted2">
              Factoring fee is added to the total; installment = (Total + Factoring fee) ÷ # installments.
            </p>
          </div>
        )}

        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="Total Amount"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            min={0}
            step={0.01}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="# of Installments"
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(e.target.value)}
            min={1}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <span className="text-[11px] text-muted uppercase tracking-wider shrink-0">Installment (read-only)</span>
          <input
            type="text"
            readOnly
            value={installmentAmount > 0 ? fmt(installmentAmount) : '—'}
            className="flex-1 min-w-0 max-w-[140px] bg-surface/50 border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] font-mono text-muted2"
          />
        </div>

        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="Every N days"
            value={freqDays}
            onChange={(e) => setFreqDays(parseInt(e.target.value, 10) || 7)}
            min={1}
            className="w-[130px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-2.5 justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50"
          >
            Add Loan
          </button>
        </div>
      </div>
    </Modal>
  );
}

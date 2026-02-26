import { useState } from 'react';
import { Modal } from '@/components/Modal';
import type { Loan } from '@/types';

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
  const [installment, setInstallment] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [freqDays, setFreqDays] = useState(7);
  const [startDate, setStartDate] = useState(todayStr);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const totalNum = parseFloat(total);
    const installmentNum = parseFloat(installment);
    const totalInstNum = parseInt(totalInstallments, 10);
    if (
      !client.trim() ||
      !totalNum ||
      !installmentNum ||
      !totalInstNum ||
      !startDate
    ) {
      window.alert('Fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({
        client: client.trim(),
        ref: ref.trim(),
        total: totalNum,
        installment: installmentNum,
        paidCount: 0,
        totalInstallments: totalInstNum,
        startDate,
        freqDays: freqDays || 7,
        paymentDates: [],
        note: '',
      });
      setClient('');
      setRef('');
      setTotal('');
      setInstallment('');
      setTotalInstallments('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setFreqDays(7);
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
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="Total Amount"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="Installment Amount"
            value={installment}
            onChange={(e) => setInstallment(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="# of Installments"
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="Every N days"
            value={freqDays}
            onChange={(e) => setFreqDays(parseInt(e.target.value, 10) || 7)}
            className="w-[130px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2.5 flex-wrap">
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

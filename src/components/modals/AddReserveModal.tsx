import { useState } from 'react';
import { Modal } from '@/components/Modal';
import type { Reserve } from '@/types';

interface AddReserveModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: Omit<Reserve, 'id'>) => Promise<Reserve>;
}

const todayStr = new Date().toISOString().split('T')[0];

export function AddReserveModal({ open, onClose, onAdd }: AddReserveModalProps) {
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [date, setDate] = useState(todayStr);
  const [freqDays, setFreqDays] = useState(7);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (!client.trim() || !amountNum || !date) {
      window.alert('Fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({
        client: client.trim(),
        amount: amountNum,
        installments: installments || 1,
        date,
        freqDays: freqDays || 7,
        note: note.trim(),
        paidCount: 0,
        deductionDates: [],
        deductionNotes: [],
      });
      setClient('');
      setAmount('');
      setInstallments(1);
      setDate(new Date().toISOString().split('T')[0]);
      setFreqDays(7);
      setNote('');
      onClose();
    } catch (err) {
      window.alert('Failed to add reserve: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Reserve Entry">
      <div className="space-y-3">
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Client Name"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="number"
            placeholder="Amount per deduction"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="# Installments"
            value={installments}
            onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 1)}
            className="w-[150px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

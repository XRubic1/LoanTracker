import { useState, useEffect } from 'react';
import type { Reserve } from '@/types';
import { Modal } from '@/components/Modal';
import { fmt, fmtDate } from '@/lib/utils';

/** Modal used on Overview: close only the next deduction for a reserve, with an optional note. */
interface CloseDeductionModalProps {
  reserve: Reserve | null;
  open: boolean;
  onClose: () => void;
  /** Saves the note and marks the next deduction in a single update (avoids race). */
  onCloseDeduction: (note: string) => Promise<void>;
}

export function CloseDeductionModal({
  reserve,
  open,
  onClose,
  onCloseDeduction,
}: CloseDeductionModalProps) {
  const [note, setNote] = useState('');

  const index = reserve ? reserve.paidCount : 0;
  const freq = reserve?.freqDays ?? 7;
  useEffect(() => {
    if (reserve && open) {
      const notes = reserve.deductionNotes ?? [];
      setNote(notes[index] ?? '');
    }
  }, [reserve, index, open]);

  if (!reserve) return null;

  const perInst = reserve.amount / reserve.installments;
  const isFullyDeducted = reserve.paidCount >= reserve.installments;
  const scheduledDate = new Date(reserve.date);
  scheduledDate.setDate(scheduledDate.getDate() + index * freq);
  const deductedDate = reserve.deductionDates?.[index];

  const handleCloseDeduction = async () => {
    await onCloseDeduction(note.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${reserve.client} — Close deduction`}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted2">
          Deduction #{index + 1} of {reserve.installments} · Scheduled {fmtDate(scheduledDate)}
          {deductedDate && <span className="text-green ml-1"> · Deducted {fmtDate(deductedDate)}</span>}
        </p>
        <div className="flex justify-between items-center py-2 border-b border-border text-[13px]">
          <span className="text-muted2">Amount</span>
          <span className="font-mono font-medium">{fmt(perInst)}</span>
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
            onClick={handleCloseDeduction}
            disabled={isFullyDeducted}
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close deduction
          </button>
        </div>
      </div>
    </Modal>
  );
}

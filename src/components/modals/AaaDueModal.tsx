import { useEffect, useState } from 'react';
import type { AaaDue } from '@/types';
import { Modal } from '@/components/Modal';
import { aaaDuePaid, aaaDueRemaining, aaaDueStatus, dayLabel, sortedDeductions, weekLabel } from '@/lib/aaaDues';
import { fmt } from '@/lib/utils';

interface AaaDueModalProps {
  due: AaaDue | null;
  open: boolean;
  onClose: () => void;
  onPost: (due: AaaDue, deduction: { amount: number; date: string; note?: string }) => Promise<{ closed: boolean }>;
  onDelete?: (id: number) => Promise<void>;
}

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const labelClass = 'block text-[11px] text-muted uppercase tracking-wider mb-1.5';
const inputClass = 'w-full border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none';

/** Post a full or partial deduction toward a weekly AAA payment; shows every deduction by day. */
export function AaaDueModal({ due, open, onClose, onPost, onDelete }: AaaDueModalProps) {
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dueId = due?.id;
  const remaining = due ? aaaDueRemaining(due) : 0;

  useEffect(() => {
    if (!open || !due) return;
    setAmountStr(remaining > 0 ? String(remaining) : '');
    setDate(todayStr());
    setNote('');
    setError(null);
    // Reset the form whenever a different payment is opened or its remaining balance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dueId, remaining]);

  if (!due) return null;

  const paid = aaaDuePaid(due);
  const status = aaaDueStatus(due);
  const amountNum = amountStr.trim() ? parseFloat(amountStr) : NaN;
  const valid = Number.isFinite(amountNum) && amountNum > 0;
  const isPartial = valid && amountNum + 0.009 < remaining;
  const deductions = sortedDeductions(due.deductions);

  const post = async () => {
    setError(null);
    if (!valid) return setError('Enter an amount greater than 0.');
    if (amountNum > remaining + 0.009) return setError(`That is more than the ${fmt(remaining)} still owed.`);
    setSubmitting(true);
    try {
      const { closed } = await onPost(due, {
        amount: Math.round(amountNum * 100) / 100,
        date: date || todayStr(),
        note: note.trim() || undefined,
      });
      setNote('');
      if (closed) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!window.confirm(`Remove this AAA payment for ${due.client}? Deductions already posted are lost.`)) return;
    setSubmitting(true);
    try {
      await onDelete(due.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title={`${due.client} — AAA payment`}>
      <div className="space-y-4">
        <p className="text-[13px] text-muted2">
          {due.payee} · Week of {weekLabel(due.weekStart)}
          {status === 'past_due' && <span className="ml-2 font-medium text-red">Past due</span>}
        </p>

        <div className="py-2 border-b border-border text-[13px] space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-muted2">Amount due</span>
            <span className="font-mono font-medium text-yellow">{fmt(due.amount)}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted2">Deducted so far</span>
              <span className="font-mono text-green">{fmt(paid)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted2">Left to close</span>
            <span className="font-mono font-medium text-accent">{fmt(remaining)}</span>
          </div>
          {paid > 0 && (
            <div className="pt-1 h-[4px] bg-border overflow-hidden">
              <div className="h-full bg-green" style={{ width: `${Math.min(100, (paid / due.amount) * 100)}%` }} />
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] text-muted uppercase tracking-wider mb-1.5">Deductions by day</div>
          {deductions.length === 0 ? (
            <p className="text-[12px] text-muted2">No deductions yet.</p>
          ) : (
            <ul className="border border-border divide-y divide-border">
              {deductions.map((d, i) => (
                <li key={`${d.date}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                  <span className="text-ink">{dayLabel(d.date)}</span>
                  {d.note && <span className="min-w-0 flex-1 truncate text-muted">{d.note}</span>}
                  <span className="font-mono font-medium text-green">{fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[12px] text-muted2 leading-relaxed">
          Enter less than what is left to take a partial deduction. When the full amount has been deducted the
          payment closes and moves to AAA Payments.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount deducted</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Day</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-[12px] text-red" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          {onDelete && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={submitting}
              className="mr-auto py-1.5 px-3 text-xs text-muted2 hover:text-red disabled:opacity-50"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="py-1.5 px-3.5 border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void post()}
            disabled={submitting || !valid}
            className="py-1.5 px-3.5 btn-primary text-xs disabled:opacity-50"
          >
            {submitting ? 'Posting…' : isPartial ? 'Post partial deduction' : 'Post & close payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

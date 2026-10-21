import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { ClientAutocomplete } from '@/components/ClientAutocomplete';
import { weekLabel, weekStartOf } from '@/lib/aaaDues';
import { AAA_PAYEES, type AaaPayee, type ClientInsurance } from '@/types';

interface AddAaaDueModalProps {
  open: boolean;
  onClose: () => void;
  clientInsurance: ClientInsurance[];
  onAdd: (payload: { client: string; payee: AaaPayee; amount: number; weekStart: string }) => Promise<void>;
}

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const labelClass = 'block text-[11px] text-muted uppercase tracking-wider mb-1.5';
const inputClass = 'w-full border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none';

/** Add a weekly AAA payment that is owed: company, payee, amount and the week it is for. */
export function AddAaaDueModal({ open, onClose, clientInsurance, onAdd }: AddAaaDueModalProps) {
  const [client, setClient] = useState('');
  const [payee, setPayee] = useState<AaaPayee>('AAA Mega Fuel');
  const [amount, setAmount] = useState('');
  const [anyDay, setAnyDay] = useState(todayStr);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClient('');
    setPayee('AAA Mega Fuel');
    setAmount('');
    setAnyDay(todayStr());
    setError(null);
  }, [open]);

  const amountNum = amount.trim() ? parseFloat(amount) : NaN;
  const week = anyDay ? weekStartOf(anyDay) : '';

  const submit = async () => {
    setError(null);
    if (!client.trim()) return setError('Enter the company this payment is for.');
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter an amount greater than 0.');
    if (!week) return setError('Pick the week this is due.');
    setSubmitting(true);
    try {
      await onAdd({ client: client.trim(), payee, amount: Math.round(amountNum * 100) / 100, weekStart: week });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title="Add AAA payment">
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Company</label>
          <ClientAutocomplete
            value={client}
            onChange={setClient}
            clientInsurance={clientInsurance}
            placeholder="Company this payment is for"
            className={inputClass}
            disabled={submitting}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelClass}>Payee</label>
            <select
              value={payee}
              onChange={(e) => setPayee(e.target.value as AaaPayee)}
              className={inputClass}
            >
              {AAA_PAYEES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Due the week of</label>
          <input type="date" value={anyDay} onChange={(e) => setAnyDay(e.target.value)} className={inputClass} />
          {week && (
            <p className="mt-1.5 text-[11px] text-muted2">
              Week: <span className="font-medium text-ink">{weekLabel(week)}</span> (Mon–Sun). If the week passes
              without it being paid, it shows as past due.
            </p>
          )}
        </div>
        {error && (
          <p className="text-[12px] text-red" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="py-1.5 px-3.5 border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="py-1.5 px-3.5 btn-primary text-xs disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

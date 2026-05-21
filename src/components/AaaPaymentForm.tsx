import { useState } from 'react';
import { AAA_PAYEES, type AaaPayee } from '@/types';

const todayStr = () => new Date().toISOString().split('T')[0];

interface AaaPaymentFormProps {
  onSubmit: (payload: {
    client: string;
    payee: AaaPayee;
    amount: number;
    paymentDate: string;
  }) => Promise<void>;
  /** compact: inline fields for stat-card slot on overview */
  compact?: boolean;
}

/** Client, payee, amount, and date — records an AAA payment. */
export function AaaPaymentForm({ onSubmit, compact = false }: AaaPaymentFormProps) {
  const [client, setClient] = useState('');
  const [payee, setPayee] = useState<AaaPayee>('AAA Lease');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!client.trim() || !amountNum || amountNum <= 0 || !paymentDate) {
      window.alert('Enter client name, date, and a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        client: client.trim(),
        payee,
        amount: amountNum,
        paymentDate,
      });
      setClient('');
      setAmount('');
      setPayee('AAA Lease');
      setPaymentDate(todayStr());
    } catch (err) {
      window.alert('Failed to record payment: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'form-input font-sans';
  const selectClass = 'select-field font-sans';
  const inputCompact = `${inputClass} form-input--compact w-full`;
  const selectCompact = `${selectClass} select-field--compact w-full`;

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Client name"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className={inputCompact}
        />
        <select
          value={payee}
          onChange={(e) => setPayee(e.target.value as AaaPayee)}
          className={selectCompact}
        >
          {AAA_PAYEES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputCompact}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={`${inputCompact} flex-1`}
          />
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary h-7 px-3 rounded-[3px] text-[11px] hover:opacity-85 disabled:opacity-50 shrink-0 whitespace-nowrap"
          >
            {submitting ? '…' : 'Record'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row flex-wrap gap-2.5">
      <input
        type="date"
        value={paymentDate}
        onChange={(e) => setPaymentDate(e.target.value)}
        className={`${inputClass} w-[140px] text-xs py-1.5 px-2.5`}
      />
      <input
        type="text"
        placeholder="Client"
        value={client}
        onChange={(e) => setClient(e.target.value)}
        className={`${inputClass} flex-1 min-w-[140px] text-xs py-1.5 px-2.5`}
      />
      <select
        value={payee}
        onChange={(e) => setPayee(e.target.value as AaaPayee)}
        className={`${selectClass} min-w-[160px] text-xs py-1.5 px-2.5`}
      >
        {AAA_PAYEES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className={`${inputClass} w-[120px] text-xs py-1.5 px-2.5`}
      />
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary py-2 px-4 rounded-lg text-[13px] disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Add payment'}
      </button>
    </form>
  );
}

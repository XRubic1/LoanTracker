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

  const compactInputClass =
    'min-w-0 flex-1 bg-surface border border-border text-text py-1 px-2 rounded-md font-sans text-[11px] outline-none focus:border-accent transition-colors';

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <div className="text-[10px] text-muted uppercase tracking-widest">AAA Payment</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            placeholder="Client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className={`${compactInputClass} min-w-[72px]`}
          />
          <select
            value={payee}
            onChange={(e) => setPayee(e.target.value as AaaPayee)}
            className={`${compactInputClass} max-w-[110px]`}
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
            className={`${compactInputClass} w-[72px] flex-none`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={`${compactInputClass} w-[108px] flex-none`}
          />
          <button
            type="submit"
            disabled={submitting}
            className="py-1 px-2.5 rounded-md bg-accent text-white text-[11px] font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors shrink-0"
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
        className="w-[140px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent transition-colors"
      />
      <input
        type="text"
        placeholder="Client"
        value={client}
        onChange={(e) => setClient(e.target.value)}
        className="flex-1 min-w-[140px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent transition-colors"
      />
      <select
        value={payee}
        onChange={(e) => setPayee(e.target.value as AaaPayee)}
        className="min-w-[160px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent transition-colors"
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
        className="w-[120px] bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        disabled={submitting}
        className="py-2 px-4 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Saving…' : 'Add payment'}
      </button>
    </form>
  );
}

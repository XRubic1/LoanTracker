import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { AAA_PAYEES, type AaaPayment, type AaaPayee } from '@/types';

interface EditAaaPaymentModalProps {
  payment: AaaPayment | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, record: AaaPayment) => Promise<AaaPayment>;
}

export function EditAaaPaymentModal({ payment, open, onClose, onSave }: EditAaaPaymentModalProps) {
  const [client, setClient] = useState('');
  const [payee, setPayee] = useState<AaaPayee>('AAA Lease');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (payment) {
      setClient(payment.client);
      setPayee(payment.payee);
      setAmount(String(payment.amount));
      setPaymentDate(payment.paymentDate);
    }
  }, [payment]);

  const handleSubmit = async () => {
    if (!payment) return;
    const amountNum = parseFloat(amount);
    if (!client.trim() || !amountNum || amountNum <= 0 || !paymentDate) {
      window.alert('Enter client, date, and a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await onSave(payment.id, {
        ...payment,
        client: client.trim(),
        payee,
        amount: amountNum,
        paymentDate,
      });
      onClose();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent';

  if (!payment) return null;

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title={`Edit — ${payment.client}`}>
      <div className="space-y-3">
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Client"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className={inputClass}
        />
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
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="py-1.5 px-3.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

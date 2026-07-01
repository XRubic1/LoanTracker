import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import {
  formatVerificationPeriodInput,
  parseVerificationPeriodInput,
} from '@/lib/clientUtils';
import { isValidClientEmail, normalizeClientEmail } from '@/lib/clientEmails';
import { CLIENT_EXPENSE_OPTIONS, type Client, type ClientExpenseType } from '@/types';

interface EditClientModalProps {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  onSave: (id: number, record: Client) => Promise<Client>;
}

export function EditClientModal({ open, client, onClose, onSave }: EditClientModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expenses, setExpenses] = useState<ClientExpenseType | ''>('');
  const [warningNote, setWarningNote] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [startedDate, setStartedDate] = useState('');
  const [verificationPeriod, setVerificationPeriod] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!client) return;
    setName(client.name);
    setEmail(client.email ?? '');
    setExpenses(client.expenses ?? '');
    setWarningNote(client.warning_note ?? '');
    setIsNewClient(client.is_new_client);
    setStartedDate(client.started_date ?? '');
    setVerificationPeriod(formatVerificationPeriodInput(client));
  }, [client]);

  const handleSubmit = async () => {
    if (!client) return;
    if (!name.trim()) {
      window.alert('Client name is required.');
      return;
    }
    if (!isValidClientEmail(email)) {
      window.alert('Please enter valid email address(es), separated by semicolons.');
      return;
    }
    setSubmitting(true);
    try {
      const period = isNewClient ? parseVerificationPeriodInput(verificationPeriod) : null;
      const verificationAlways = period?.verification_always ?? false;
      if (isNewClient && !verificationAlways && !startedDate.trim()) {
        window.alert('Please set the start date, or use "always" for verification period.');
        return;
      }
      const tracked = isNewClient || verificationAlways;
      await onSave(client.id, {
        ...client,
        name: name.trim(),
        email: normalizeClientEmail(email),
        expenses: expenses || null,
        warning_note: warningNote.trim() || null,
        is_new_client: tracked,
        started_date: tracked && startedDate.trim() ? startedDate.trim() : null,
        verification_always: verificationAlways,
        verification_days: period?.verification_days ?? 30,
        new_client_reviewed: isNewClient
          ? period?.verification_always
            ? true
            : client.new_client_reviewed
          : false,
      });
      onClose();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!client) return null;

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title="Edit client">
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Client name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Email</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com; billing@example.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
          <p className="text-[11px] text-muted2 mt-1">Separate multiple addresses with a semicolon (;).</p>
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Expenses</label>
          <select
            value={expenses}
            onChange={(e) => setExpenses(e.target.value as ClientExpenseType | '')}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          >
            <option value="">—</option>
            {CLIENT_EXPENSE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Warning note</label>
          <textarea
            value={warningNote}
            onChange={(e) => setWarningNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink resize-y"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
          <input type="checkbox" checked={isNewClient} onChange={(e) => setIsNewClient(e.target.checked)} />
          New client (verification period)
        </label>
        {isNewClient && (
          <>
            <div>
              <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Start date</label>
              <input
                type="date"
                value={startedDate}
                onChange={(e) => setStartedDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
                Verification period (days)
              </label>
              <input
                type="text"
                value={verificationPeriod}
                onChange={(e) => setVerificationPeriod(e.target.value)}
                placeholder='30 or "always"'
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
              />
              <p className="text-[11px] text-muted2 mt-1">
                Type <strong className="text-ink">always</strong> for permanent verification (no review due).
              </p>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="py-2 px-4 rounded-lg border border-border text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="py-2 px-4 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

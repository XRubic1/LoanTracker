import { useState } from 'react';
import { Modal } from '@/components/Modal';
import type { ClientInsurance } from '@/types';

type StatusOption = 'OK' | 'Inactive' | 'Cancellation' | 'OUT';

function statusToValue(opt: StatusOption): string {
  if (opt === 'OK') return 'OK';
  if (opt === 'Inactive') return 'inactive';
  if (opt === 'OUT') return 'out';
  if (opt === 'Cancellation') return 'cancellation';
  return 'OK';
}

interface AddClientInsuranceModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: Omit<ClientInsurance, 'id'>) => Promise<ClientInsurance>;
}

export function AddClientInsuranceModal({ open, onClose, onAdd }: AddClientInsuranceModalProps) {
  const [client, setClient] = useState('');
  const [mc, setMc] = useState('');
  const [status, setStatus] = useState<StatusOption>('OK');
  const [cancellationDate, setCancellationDate] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [startedDate, setStartedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!client.trim() || !mc.trim()) {
      window.alert('Client and MC are required.');
      return;
    }
    if (status === 'Cancellation' && !cancellationDate.trim()) {
      window.alert('Please set a date when Cancellation is selected.');
      return;
    }
    if (isNewClient && !startedDate.trim()) {
      window.alert('Please set the start date for a new client.');
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({
        client: client.trim(),
        mc: mc.trim(),
        status: statusToValue(status),
        expiration_date: cancellationDate.trim() || null,
        last_cancellation_date: null,
        is_new_client: isNewClient,
        started_date: isNewClient ? startedDate.trim() : null,
        new_client_reviewed: false,
        verification_days: 30,
      });
      setClient('');
      setMc('');
      setStatus('OK');
      setCancellationDate('');
      setIsNewClient(false);
      setStartedDate(new Date().toISOString().split('T')[0]);
      onClose();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add client (insurance)">
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Client</label>
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Client name"
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">MC</label>
          <input
            type="text"
            value={mc}
            onChange={(e) => setMc(e.target.value)}
            placeholder="MC number"
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusOption)}
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent"
          >
            <option value="OK">OK</option>
            <option value="Inactive">Inactive</option>
            <option value="Cancellation">Cancellation</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div className="rounded-lg border border-border bg-surface/50 px-3 py-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isNewClient}
              onChange={(e) => setIsNewClient(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-[13px] font-medium text-ink">New client</span>
          </label>
          {isNewClient && (
            <div>
              <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
                Started with us
              </label>
              <input
                type="date"
                value={startedDate}
                onChange={(e) => setStartedDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent"
              />
              <p className="text-[11px] text-muted2 mt-1.5">
                After 30 days you will be prompted to review this client. You can extend the period or mark reviewed when done.
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
            Cancellation{status === 'Cancellation' ? ' (required)' : ''}
          </label>
          <input
            type="date"
            value={cancellationDate}
            onChange={(e) => setCancellationDate(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-ink outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add client'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

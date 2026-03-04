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
    setSubmitting(true);
    try {
      await onAdd({
        client: client.trim(),
        mc: mc.trim(),
        status: statusToValue(status),
        expiration_date: cancellationDate.trim() || null,
        last_cancellation_date: null,
      });
      setClient('');
      setMc('');
      setStatus('OK');
      setCancellationDate('');
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
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">MC</label>
          <input
            type="text"
            value={mc}
            onChange={(e) => setMc(e.target.value)}
            placeholder="MC number"
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusOption)}
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-text outline-none focus:border-accent"
          >
            <option value="OK">OK</option>
            <option value="Inactive">Inactive</option>
            <option value="Cancellation">Cancellation</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">
            Cancellation{status === 'Cancellation' ? ' (required)' : ''}
          </label>
          <input
            type="date"
            value={cancellationDate}
            onChange={(e) => setCancellationDate(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg py-2 px-3 text-[13px] text-text outline-none focus:border-accent"
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
            className="py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium hover:bg-[#3a7de8] disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add client'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

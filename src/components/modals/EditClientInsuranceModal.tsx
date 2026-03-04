import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import type { ClientInsurance } from '@/types';

export type StatusOption = 'OK' | 'Inactive' | 'Cancellation' | 'OUT';

/** Parse existing status into dropdown value. Cancellation date comes from expiration_date. */
function parseStatusOption(status: string): StatusOption {
  const s = (status ?? '').trim().toLowerCase();
  if (!s) return 'OK';
  if (s === 'inactive') return 'Inactive';
  if (s === 'out') return 'OUT';
  if (s.startsWith('cancellation') || s.includes('cancellation')) return 'Cancellation';
  return 'OK';
}

/** Status stored in DB (no date in string; date is in expiration_date). */
function buildStatus(option: StatusOption): string {
  if (option === 'OK') return 'OK';
  if (option === 'Inactive') return 'inactive';
  if (option === 'OUT') return 'out';
  if (option === 'Cancellation') return 'cancellation';
  return 'OK';
}

interface EditClientInsuranceModalProps {
  clientInsurance: ClientInsurance | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, record: ClientInsurance) => Promise<ClientInsurance>;
}

export function EditClientInsuranceModal({
  clientInsurance,
  open,
  onClose,
  onSave,
}: EditClientInsuranceModalProps) {
  const [option, setOption] = useState<StatusOption>('OK');
  const [cancellationDate, setCancellationDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (clientInsurance) {
      setOption(parseStatusOption(clientInsurance.status));
      setCancellationDate(clientInsurance.expiration_date ?? '');
    }
  }, [clientInsurance]);

  const handleSubmit = async () => {
    if (!clientInsurance) return;
    if (option === 'Cancellation' && !cancellationDate.trim()) {
      window.alert('Please set a date when Cancellation is selected.');
      return;
    }
    setSubmitting(true);
    try {
      const status = buildStatus(option);
      await onSave(clientInsurance.id, {
        ...clientInsurance,
        status,
        expiration_date: cancellationDate.trim() || null,
      });
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

  if (!clientInsurance) return null;

  return (
    <Modal open={open} onClose={handleClose} title={`Edit — ${clientInsurance.client}`}>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Client</span>
          <span className="font-medium">{clientInsurance.client}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">MC</span>
          <span className="font-mono">{clientInsurance.mc}</span>
        </div>

        <div>
          <label className="block text-[11px] text-muted uppercase tracking-wider mb-1.5">Status</label>
          <select
            value={option}
            onChange={(e) => setOption(e.target.value as StatusOption)}
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
            Cancellation{option === 'Cancellation' ? ' (required)' : ''}
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
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

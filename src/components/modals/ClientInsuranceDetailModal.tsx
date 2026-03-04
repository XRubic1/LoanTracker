import { Modal } from '@/components/Modal';
import type { ClientInsurance } from '@/types';
import { getClientInsuranceStatusLabel, isClientInsuranceWarning } from '@/lib/clientInsuranceUtils';

interface ClientInsuranceDetailModalProps {
  clientInsurance: ClientInsurance | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export function ClientInsuranceDetailModal({
  clientInsurance,
  open,
  onClose,
  onEdit,
  onDelete,
}: ClientInsuranceDetailModalProps) {
  if (!clientInsurance) return null;

  const isWarning = isClientInsuranceWarning(clientInsurance);
  const statusLabel = getClientInsuranceStatusLabel(clientInsurance);

  const handleDelete = () => {
    if (!onDelete || !window.confirm(`Delete client "${clientInsurance.client}" (MC ${clientInsurance.mc})?`)) return;
    onDelete(clientInsurance.id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`${clientInsurance.client} — MC ${clientInsurance.mc}`}>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Client</span>
          <span className="font-medium">{clientInsurance.client}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">MC</span>
          <span className="font-mono">{clientInsurance.mc}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
          <span className="text-muted2">Status</span>
          <span
            className={`font-medium ${
              isWarning ? 'text-yellow' : statusLabel.toLowerCase() === 'ok' ? 'text-green' : ''
            }`}
          >
            {statusLabel}
          </span>
        </div>
        {clientInsurance.expiration_date && (
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Cancellation</span>
            <span className="font-mono">
              {new Date(clientInsurance.expiration_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="mr-auto py-1.5 px-3.5 rounded-lg border border-red/30 text-red text-xs font-medium hover:bg-red/10"
            >
              Delete
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(clientInsurance.id)}
              className="py-1.5 px-3.5 rounded-lg border border-accent/50 text-accent text-xs font-medium hover:bg-accent/10"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

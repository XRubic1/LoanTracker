import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import type { ClientInsurance, ClientInsuranceCancellationAudit } from '@/types';
import { getClientInsuranceStatusLabel, isClientInsuranceWarning, isClientInsuranceOut } from '@/lib/clientInsuranceUtils';
import { fetchCancellationAuditByClientId } from '@/lib/supabase-db';

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
  const [cancellationAudit, setCancellationAudit] = useState<ClientInsuranceCancellationAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  useEffect(() => {
    if (!open || !clientInsurance) {
      setCancellationAudit([]);
      return;
    }
    setAuditLoading(true);
    fetchCancellationAuditByClientId(clientInsurance.id)
      .then(setCancellationAudit)
      .catch(() => setCancellationAudit([]))
      .finally(() => setAuditLoading(false));
  }, [open, clientInsurance?.id]);

  if (!clientInsurance) return null;

  const isOut = isClientInsuranceOut(clientInsurance);
  const isWarning = isClientInsuranceWarning(clientInsurance);
  const statusLabel = getClientInsuranceStatusLabel(clientInsurance);
  const auditCount = cancellationAudit.length;

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
              isOut ? 'text-red' : isWarning ? 'text-yellow' : statusLabel.toLowerCase() === 'ok' ? 'text-green' : ''
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
        {clientInsurance.last_cancellation_date && (
          <div className="flex justify-between items-center py-2.5 border-b border-border text-[13px]">
            <span className="text-muted2">Last cancellation (audit)</span>
            <span className="font-mono text-muted2">
              {new Date(clientInsurance.last_cancellation_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-end pt-2 items-center">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="mr-auto py-1.5 px-3.5 rounded-lg border border-red/30 text-red text-xs font-medium hover:bg-red/10"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            disabled={auditLoading}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-60"
            title="View all cancellation dates"
          >
            Audit ({auditCount})
          </button>
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

      <Modal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title={`Cancellation history — ${clientInsurance.client}`}
      >
        <p className="text-[13px] text-muted2 mb-3">
          All dates this client was recorded with cancellation status (newest first).
        </p>
        {auditLoading ? (
          <p className="text-[13px] text-muted2">Loading…</p>
        ) : auditCount === 0 ? (
          <p className="text-[13px] text-muted2">No cancellation history.</p>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {cancellationAudit.map((entry) => (
              <li
                key={entry.id}
                className="flex justify-between items-center py-2 border-b border-border/40 text-[13px]"
              >
                <span className="font-mono text-text">
                  {new Date(entry.cancellation_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => setAuditModalOpen(false)}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>
      </Modal>
    </Modal>
  );
}

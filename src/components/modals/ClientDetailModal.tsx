import { Modal } from '@/components/Modal';
import { NewClientReviewPanel } from '@/components/NewClientReviewPanel';
import { isClientVerificationTracked, formatExpenseFee } from '@/lib/clientUtils';
import type { Client } from '@/types';

interface ClientDetailModalProps {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  onEdit: () => void;
  onSave: (id: number, record: Client) => Promise<Client>;
}

export function ClientDetailModal({ open, client, onClose, onEdit, onSave }: ClientDetailModalProps) {
  if (!client) return null;

  return (
    <Modal open={open} onClose={onClose} title={client.name}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Expenses</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['ACH', client.ach_expense],
                  ['Wire', client.wire_expense],
                ] as const
              ).map(([method, fee]) => {
                const chosen = client.expenses === method;
                return (
                  <div
                    key={method}
                    className={`rounded-lg border px-3 py-2 ${
                      chosen ? 'border-accent bg-accent/10' : 'border-border'
                    }`}
                  >
                    <p className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
                      {method} fee
                      {chosen ? <span className="font-semibold text-accent">Uses this</span> : null}
                    </p>
                    <p className="mt-0.5 text-[16px] font-medium tabular-nums text-ink">{formatExpenseFee(fee)}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Email</p>
            <p className="text-ink break-all">{client.email?.trim() || '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Warning note</p>
            <p className={`text-ink ${client.warning_note?.trim() ? 'text-accent' : 'text-muted2'}`}>
              {client.warning_note?.trim() || '—'}
            </p>
          </div>
        </div>
        {isClientVerificationTracked(client) && (
          <NewClientReviewPanel
            client={client}
            onSave={(record) => onSave(client.id, record)}
          />
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onEdit}
            className="py-2 px-4 rounded-lg border border-border text-sm text-muted2 hover:text-accent"
          >
            Edit
          </button>
          <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-accent text-white text-sm">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

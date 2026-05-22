import { Modal } from '@/components/Modal';
import { WorksheetEntryForm } from '@/components/WorksheetEntryForm';
import type { Client, ClientInsurance, WorksheetEntry } from '@/types';

interface WorksheetEntryModalProps {
  open: boolean;
  entry: WorksheetEntry | null;
  clients: Client[];
  clientInsurance?: ClientInsurance[];
  onClose: () => void;
  onSave: (
    payload: Omit<WorksheetEntry, 'id' | 'owner_id' | 'created_by'> | WorksheetEntry
  ) => Promise<void>;
}

export function WorksheetEntryModal({
  open,
  entry,
  clients,
  clientInsurance = [],
  onClose,
  onSave,
}: WorksheetEntryModalProps) {
  if (!open || !entry) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit batch">
      <WorksheetEntryForm
        clients={clients}
        clientInsurance={clientInsurance}
        entry={entry}
        onSubmit={onSave}
        onCancel={onClose}
        variant="stacked"
      />
    </Modal>
  );
}

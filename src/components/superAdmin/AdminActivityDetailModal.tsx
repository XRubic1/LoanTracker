import type { Client, ClientInsurance, WorksheetEntry } from '@/types';
import { Modal } from '@/components/Modal';
import { ActivityEntryFlags } from '@/components/userActivity/ActivityEntryFlags';
import { WorkPaceCell } from '@/components/userActivity/WorkPaceCell';
import { fmtDateTime } from '@/lib/utils';
import {
  getWorksheetEntryDisplayName,
  getWorksheetEntryFlags,
  type WorksheetEntryFlag,
} from '@/lib/worksheetUtils';
import type { WorkDurationFinding } from '@/lib/worksheetTiming';

interface AdminActivityDetailModalProps {
  entry: WorksheetEntry | null;
  companyName: string | null;
  userLabel: string;
  clientsById: Map<number, Client>;
  clientInsurance: ClientInsurance[];
  durationFinding?: WorkDurationFinding | null;
  /** Other batches by the same user on the same work date. */
  relatedEntries: WorksheetEntry[];
  open: boolean;
  onClose: () => void;
  onSelectRelated?: (entry: WorksheetEntry) => void;
}

/**
 * Read-only Super Admin detail for a single worksheet activity batch.
 */
export function AdminActivityDetailModal({
  entry,
  companyName,
  userLabel,
  clientsById,
  clientInsurance,
  durationFinding = null,
  relatedEntries,
  open,
  onClose,
  onSelectRelated,
}: AdminActivityDetailModalProps) {
  if (!entry) return null;

  const clientName = getWorksheetEntryDisplayName(entry, clientsById);
  const client =
    entry.client_id != null ? clientsById.get(entry.client_id) ?? null : null;
  const flags: WorksheetEntryFlag[] = getWorksheetEntryFlags(
    entry,
    clientsById,
    clientInsurance,
    durationFinding
      ? new Map([[entry.id, durationFinding]])
      : undefined
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Activity — ${clientName}`}
      panelClassName="panel-surface rounded-xl p-5 w-[680px] max-w-[96vw] max-h-[90vh] flex flex-col"
    >
      <div className="space-y-4 min-h-0 flex flex-col overflow-auto admin-table-scroll">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Team</div>
            <div className="text-[12px] font-medium text-ink truncate">
              {companyName ?? 'Unassigned'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">User</div>
            <div className="text-[12px] font-medium text-ink truncate" title={userLabel}>
              {userLabel}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Work date</div>
            <div className="text-[12px] font-medium text-ink tabular-nums">{entry.work_date}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Saved</div>
            <div className="text-[12px] font-medium text-ink tabular-nums">
              {fmtDateTime(entry.created_at)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Invoices</div>
            <div className="text-[16px] font-medium text-ink tabular-nums leading-none">
              {entry.invoice_count}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Verified</div>
            <div
              className={`text-[16px] font-medium leading-none ${
                entry.verified ? 'text-green' : 'text-red'
              }`}
            >
              {entry.verified ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Group work</div>
            <div className="text-[16px] font-medium text-ink leading-none">
              {entry.group_work ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-label mb-0.5">Pace</div>
            <div className="mt-0.5">
              <WorkPaceCell finding={durationFinding ?? undefined} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface/40 px-3 py-2.5 text-[12px] space-y-1.5">
          <div className="flex justify-between gap-3">
            <span className="text-muted2">Client</span>
            <span className="font-medium text-ink text-right">{clientName}</span>
          </div>
          {client?.warning_note?.trim() && (
            <div className="flex justify-between gap-3">
              <span className="text-muted2">Warning</span>
              <span className="text-ink text-right">{client.warning_note.trim()}</span>
            </div>
          )}
          {client?.expenses?.trim() && (
            <div className="flex justify-between gap-3">
              <span className="text-muted2">Expenses</span>
              <span className="text-ink text-right">{client.expenses.trim()}</span>
            </div>
          )}
          {entry.note?.trim() && (
            <div className="flex justify-between gap-3">
              <span className="text-muted2">Batch note</span>
              <span className="text-ink text-right">{entry.note.trim()}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 items-start">
            <span className="text-muted2 pt-0.5">Flags</span>
            <ActivityEntryFlags flags={flags} />
          </div>
        </div>

        {relatedEntries.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] text-muted uppercase tracking-wider">
              Same user · same day ({relatedEntries.length})
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-[var(--color-panel)] text-[10px] uppercase tracking-wider text-label">
                    <th className="text-left font-normal px-3 py-1.5">Saved</th>
                    <th className="text-left font-normal px-3 py-1.5">Client</th>
                    <th className="text-right font-normal px-3 py-1.5">Inv.</th>
                    <th className="text-center font-normal px-3 py-1.5">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedEntries.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border last:border-b-0 ${
                        onSelectRelated ? 'row-hover cursor-pointer' : ''
                      }`}
                      onClick={() => onSelectRelated?.(r)}
                    >
                      <td className="px-3 py-1.5 text-muted2 tabular-nums whitespace-nowrap">
                        {fmtDateTime(r.created_at)}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-ink truncate max-w-[200px]">
                        {getWorksheetEntryDisplayName(r, clientsById)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.invoice_count}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={r.verified ? 'text-green' : 'text-red'}>
                          {r.verified ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end flex-shrink-0 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg border border-border text-muted2 text-xs font-medium bg-transparent hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

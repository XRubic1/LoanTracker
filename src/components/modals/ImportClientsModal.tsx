import { useRef, useState } from 'react';
import { Modal } from '@/components/Modal';
import { buildClientImportBatch } from '@/lib/importClientsBatch';
import {
  downloadClientsImportTemplate,
  parseClientsExcelFile,
  type ClientImportPreviewRow,
} from '@/lib/importClientsExcel';
import type { Client } from '@/types';

export interface ClientImportResult {
  toAdd: Omit<Client, 'id'>[];
  toUpdate: Client[];
  toDelete: Client[];
}

interface ImportClientsModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onImport: (batch: ClientImportResult) => Promise<void>;
}

export function ImportClientsModal({ open, onClose, clients, onImport }: ImportClientsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ClientImportPreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [deleteNotInFile, setDeleteNotInFile] = useState(false);

  const batch = buildClientImportBatch(preview, clients, { overrideExisting, deleteNotInFile });
  const duplicateCount = preview.filter((r) => r.status === 'duplicate').length;
  const invalidCount = preview.filter((r) => r.status === 'invalid').length;
  const canImport =
    batch.toAdd.length > 0 || batch.toUpdate.length > 0 || batch.toDelete.length > 0;

  const reset = () => {
    setPreview([]);
    setParseErrors([]);
    setFileName(null);
    setOverrideExisting(false);
    setDeleteNotInFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (!parsing && !importing) {
      reset();
      onClose();
    }
  };

  const reparseWithOptions = async (file: File, override: boolean) => {
    setParsing(true);
    setParseErrors([]);
    try {
      const { rows, parseErrors: errors } = await parseClientsExcelFile(file, clients, {
        overrideExisting: override,
      });
      setPreview(rows);
      setParseErrors(errors);
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setParsing(false);
    }
  };

  const lastFileRef = useRef<File | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    lastFileRef.current = file;
    setFileName(file.name);
    await reparseWithOptions(file, overrideExisting);
  };

  const handleOverrideToggle = async (checked: boolean) => {
    setOverrideExisting(checked);
    if (lastFileRef.current) {
      await reparseWithOptions(lastFileRef.current, checked);
    }
  };

  const handleImport = async () => {
    if (!canImport) {
      window.alert('Nothing to import. Add new rows, enable override, or enable delete missing clients.');
      return;
    }
    if (batch.toDelete.length > 0) {
      const ok = window.confirm(
        `Delete ${batch.toDelete.length} client${batch.toDelete.length !== 1 ? 's' : ''} that are not in this file?\n\nThis cannot be undone. Clients with worksheet entries cannot be deleted.`
      );
      if (!ok) return;
    }
    setImporting(true);
    try {
      await onImport(batch);
      reset();
      onClose();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadClientsImportTemplate();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  };

  const importSummary = [
    batch.toAdd.length > 0 && `${batch.toAdd.length} new`,
    batch.toUpdate.length > 0 && `${batch.toUpdate.length} update`,
    batch.toDelete.length > 0 && `${batch.toDelete.length} delete`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal open={open} onClose={handleClose} title="Import clients from Excel">
      <p className="text-[13px] text-muted2 mb-4">
        Upload an Excel file (.xlsx, .xls) with client details. Download the template for the correct
        columns: Client Name, Expenses (Wire or ACH), Warning Note, New Client, Started Date, Client
        Reviewed, Verification Days (number or &quot;always&quot;).
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => void handleDownloadTemplate()}
          className="py-2 px-3 rounded-lg border border-border text-xs font-medium text-muted2 hover:border-accent hover:text-accent"
        >
          Download template
        </button>
        <label className="py-2 px-3 rounded-lg border border-accent/50 bg-accent/5 text-xs font-medium text-accent cursor-pointer hover:bg-accent/10">
          Choose Excel file
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
        </label>
        {fileName && (
          <span className="text-[12px] text-muted2 self-center truncate max-w-[200px]">{fileName}</span>
        )}
      </div>

      <div className="mb-4 space-y-2 rounded-lg border border-border bg-surface/50 px-3 py-3">
        <label className="flex items-start gap-2 text-[13px] text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={overrideExisting}
            onChange={(e) => void handleOverrideToggle(e.target.checked)}
            disabled={parsing || importing || !fileName}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Override existing clients</span>
            <span className="block text-[12px] text-muted2 mt-0.5">
              Update clients that match a name in the file instead of skipping them.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13px] text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={deleteNotInFile}
            onChange={(e) => setDeleteNotInFile(e.target.checked)}
            disabled={parsing || importing || preview.length === 0}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-red">Delete clients not in file</span>
            <span className="block text-[12px] text-muted2 mt-0.5">
              Remove registry clients whose names are missing from the spreadsheet.
              {preview.length > 0 && deleteNotInFile && (
                <span className="text-red font-medium">
                  {' '}
                  {batch.toDelete.length} will be deleted.
                </span>
              )}
            </span>
          </span>
        </label>
      </div>

      {parseErrors.length > 0 && (
        <div className="mb-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-[12px] text-red space-y-1">
          {parseErrors.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      )}

      {parsing && <p className="text-[13px] text-muted2 mb-3">Reading file…</p>}

      {preview.length > 0 && !parsing && (
        <>
          <p className="text-[12px] text-muted2 mb-2">
            {importSummary || 'No changes'}
            {duplicateCount > 0 && !overrideExisting && ` · ${duplicateCount} skipped (already exist)`}
            {invalidCount > 0 && ` · ${invalidCount} invalid`}
          </p>
          <div className="overflow-x-auto max-h-[40vh] border border-border rounded-lg">
            <table className="w-full text-[12px]">
              <thead className="bg-surface sticky top-0">
                <tr className="text-left text-muted2 border-b border-border">
                  <th className="py-2 px-2">Row</th>
                  <th className="py-2 px-2">Client</th>
                  <th className="py-2 px-2">Expenses</th>
                  <th className="py-2 px-2">Warning</th>
                  <th className="py-2 px-2">New</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`border-b border-divider ${
                      row.status === 'invalid'
                        ? 'bg-red/5'
                        : row.status === 'duplicate'
                          ? 'opacity-60'
                          : row.status === 'override'
                            ? 'bg-accent/5'
                            : ''
                    }`}
                  >
                    <td className="py-1.5 px-2 text-muted2">{row.rowNumber}</td>
                    <td className="py-1.5 px-2 font-medium text-ink">{row.payload.name}</td>
                    <td className="py-1.5 px-2">{row.payload.expenses ?? '—'}</td>
                    <td className="py-1.5 px-2 max-w-[120px] truncate">
                      {row.payload.warning_note ?? '—'}
                    </td>
                    <td className="py-1.5 px-2">
                      {row.payload.is_new_client ? 'YES' : 'NO'}
                    </td>
                    <td className="py-1.5 px-2">
                      {row.status === 'new' && <span className="text-green">New</span>}
                      {row.status === 'override' && (
                        <span className="text-accent font-medium">Update</span>
                      )}
                      {row.status === 'duplicate' && (
                        <span className="text-muted2">Skip</span>
                      )}
                      {row.status === 'invalid' && (
                        <span className="text-red" title={row.message}>
                          {row.message ?? 'Invalid'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={handleClose}
          disabled={parsing || importing}
          className="py-2 px-4 rounded-lg border border-border text-sm text-muted2 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={parsing || importing || !canImport}
          className="py-2 px-4 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
        >
          {importing ? 'Applying…' : canImport ? `Apply (${importSummary})` : 'Apply'}
        </button>
      </div>
    </Modal>
  );
}

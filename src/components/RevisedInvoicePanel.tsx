import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRevisedInvoice,
  listRevisedInvoices,
  processRevisedInvoices,
  removeRevisedInvoice,
  searchPortalInvoices,
  uploadRevisedDocuments,
  type PortalAccount,
  type PortalInvoice,
  type RevisedInvoice,
} from '@/lib/portalUpload';
import { findFamily, nextRevisionNumber, revisionSuffix } from '@/lib/revisedInvoices';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const MAX_FILE_BYTES = 16 * 1024 * 1024;

type Status = { ok: boolean; text: string } | null;

/** One box finds an invoice by invoice #, load # or customer. */
async function searchEverywhere(accountId: number, query: string): Promise<PortalInvoice[]> {
  const runs = await Promise.allSettled([
    searchPortalInvoices({ accountId, invoice: query }),
    searchPortalInvoices({ accountId, poId: query }),
    searchPortalInvoices({ accountId, debtorName: query }),
  ]);
  const ok = runs.filter((r): r is PromiseFulfilledResult<{ invoices: PortalInvoice[] }> => r.status === 'fulfilled');
  if (ok.length === 0) {
    const failed = runs.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw failed?.reason instanceof Error ? failed.reason : new Error('Search failed');
  }
  const byKey = new Map<number, PortalInvoice>();
  for (const run of ok) for (const invoice of run.value.invoices) byKey.set(invoice.invoiceKey, invoice);
  return [...byKey.values()].sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo, undefined, { numeric: true }));
}

/** Files to attach: drop them or click. Nothing else to press. */
function FileChooser({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (list: FileList | File[]) => {
    const known = new Set(files.map((f) => `${f.name}:${f.size}`));
    onChange([...files, ...[...list].filter((f) => !known.has(`${f.name}:${f.size}`))]);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && input.current?.click()}
        className={`cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-sm ${
          dragging ? 'border-accent bg-accent/5 text-ink' : 'border-border text-muted hover:border-accent'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        Drop revised documents here
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((file) => (
            <li
              key={`${file.name}:${file.size}`}
              className={`flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs ${
                file.size > MAX_FILE_BYTES ? 'text-red' : 'text-ink'
              }`}
              title={file.size > MAX_FILE_BYTES ? 'Over 16 MB' : file.name}
            >
              <span className="max-w-[220px] truncate">{file.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((f) => f !== file))}
                className="text-muted hover:text-red"
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A created invoice in the waiting list. Dropping or choosing files uploads them straight away. */
function WaitingRow({
  accountId,
  row,
  checked,
  busy,
  onToggle,
  onRemove,
  onUploaded,
}: {
  accountId: number;
  row: RevisedInvoice;
  checked: boolean;
  busy: boolean;
  onToggle: (value: boolean) => void;
  onRemove: () => void;
  onUploaded: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (list: FileList | File[]) => {
    const files = [...list];
    if (files.length === 0) return;
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over 16 MB`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadRevisedDocuments({ accountId, id: row.id, files });
      await onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <li
      onDragOver={(e) => {
        e.preventDefault();
        if (row.in_portal) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (row.in_portal) void upload(e.dataTransfer.files);
      }}
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm ${dragging ? 'bg-accent/10' : ''}`}
    >
      <input
        type="checkbox"
        aria-label={`Process invoice ${row.new_invoice_no}`}
        checked={row.in_portal && checked}
        disabled={!row.in_portal || busy}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="w-28 font-semibold text-ink">#{row.new_invoice_no}</span>
      <span className="min-w-0 flex-1 truncate text-ink">{row.broker}</span>
      <span className="font-medium text-ink">{money(row.amount)}</span>
      {row.in_portal ? (
        <button
          type="button"
          disabled={uploading || busy}
          onClick={() => input.current?.click()}
          title={row.files.length ? row.files.join('\n') : 'Drop files on this row or click to add'}
          className={`text-xs hover:underline disabled:opacity-60 ${row.files.length ? 'text-green' : 'text-red'}`}
        >
          {uploading
            ? 'Uploading…'
            : row.files.length
              ? `${row.files.length} file${row.files.length === 1 ? '' : 's'} · add`
              : '+ Add documents'}
        </button>
      ) : (
        <span className="text-xs text-red" title="Processed or removed in the portal itself">
          Not on the portal's list
        </span>
      )}
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={busy || uploading}
        onClick={onRemove}
        className="text-xs text-muted hover:text-red disabled:opacity-60"
      >
        Remove
      </button>
      {error && <p className="basis-full text-xs text-red">{error}</p>}
    </li>
  );
}

/** Find an invoice, enter the difference, add documents, create. Then process what you created. */
export function RevisedInvoicePanel({ accounts, onChanged }: { accounts: PortalAccount[]; onChanged: () => void }) {
  const [accountId, setAccountId] = useState<number | ''>(accounts[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PortalInvoice[] | null>(null);
  const [selected, setSelected] = useState<PortalInvoice | null>(null);
  /** The original invoice and all its revisions, loaded when an invoice is picked. */
  const [family, setFamily] = useState<ReturnType<typeof findFamily<PortalInvoice>> | null>(null);
  const [difference, setDifference] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const [list, setList] = useState<RevisedInvoice[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  /** Invoices the list has already shown, so only new ones start checked. */
  const knownIds = useRef<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [listStatus, setListStatus] = useState<Status>(null);

  useEffect(() => {
    if (accountId === '' && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const loadList = useCallback(async () => {
    if (accountId === '') return;
    try {
      const { revised } = await listRevisedInvoices(accountId);
      // New invoices start checked, as they have to be on the portal's schedule page.
      const fresh = new Set(revised.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id));
      revised.forEach((r) => knownIds.current.add(r.id));
      setList(revised);
      setChecked((current) => {
        const next = new Set<number>();
        for (const r of revised) if (r.in_portal && (fresh.has(r.id) || current.has(r.id))) next.add(r.id);
        return next;
      });
    } catch (err) {
      setListStatus({ ok: false, text: err instanceof Error ? err.message : 'Could not load the list' });
    }
  }, [accountId]);

  useEffect(() => {
    setList([]);
    knownIds.current = new Set();
    setChecked(new Set());
    setListStatus(null);
    void loadList();
  }, [loadList]);

  const choose = useCallback(
    async (invoice: PortalInvoice) => {
      setSelected(invoice);
      setFamily(null);
      setStatus(null);
      if (accountId === '') return;
      try {
        const { invoices } = await searchPortalInvoices({
          accountId,
          invoice: invoice.invoiceNo.replace(/R\d*$/i, '') || invoice.invoiceNo,
        });
        setFamily(findFamily(invoices, invoice));
      } catch {
        setFamily(findFamily([invoice], invoice));
      }
    },
    [accountId]
  );

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (accountId === '' || !query.trim()) return;
    setSearching(true);
    setStatus(null);
    setSelected(null);
    setFamily(null);
    try {
      const found = await searchEverywhere(accountId, query.trim());
      setMatches(found);
      if (found.length === 1) void choose(found[0]);
    } catch (err) {
      setMatches(null);
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Search failed' });
    } finally {
      setSearching(false);
    }
  };

  const members = family?.members ?? [];
  const suffix = revisionSuffix(nextRevisionNumber(members));
  const baseNo = family?.base ?? selected?.invoiceNo ?? '';
  const basePo = ((family?.original ?? selected)?.poId ?? '').replace(/R\d*$/i, '');
  const newInvoiceNo = `${baseNo}${suffix}`;
  const familyTotal = members.reduce((sum, m) => sum + m.amount, 0);
  const differenceNum = difference.trim() ? Math.round(parseFloat(difference) * 100) / 100 : NaN;
  const differenceOk = Number.isFinite(differenceNum) && differenceNum > 0;
  const filesOk = files.every((f) => f.size <= MAX_FILE_BYTES);

  const create = async () => {
    if (accountId === '' || !selected || !differenceOk || !filesOk) return;
    setCreating(true);
    setStatus(null);
    try {
      const { revised } = await createRevisedInvoice({ accountId, invoice: selected, amount: differenceNum });
      let text = `Created #${revised.new_invoice_no} for ${money(revised.amount)}`;
      let ok = true;
      if (files.length > 0) {
        try {
          await uploadRevisedDocuments({ accountId, id: revised.id, files });
          text += ` with ${files.length} document${files.length === 1 ? '' : 's'}`;
        } catch (err) {
          ok = false;
          text += `, but the documents did not upload (${err instanceof Error ? err.message : 'error'}). Add them from the list below.`;
        }
      }
      setStatus({ ok, text: `${text}${ok ? '.' : ''}` });
      setDifference('');
      setFiles([]);
      setSelected(null);
      setFamily(null);
      setMatches(null);
      setQuery('');
      await loadList();
      onChanged();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Could not create the invoice' });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (row: RevisedInvoice) => {
    if (accountId === '') return;
    if (!window.confirm(`Remove #${row.new_invoice_no}?`)) return;
    setListStatus(null);
    try {
      await removeRevisedInvoice({ accountId, id: row.id });
      await loadList();
      onChanged();
    } catch (err) {
      setListStatus({ ok: false, text: err instanceof Error ? err.message : 'Could not remove the invoice' });
    }
  };

  const selectedRows = list.filter((r) => r.in_portal && checked.has(r.id));
  const selectedTotal = selectedRows.reduce((sum, r) => sum + r.amount, 0);

  const process = async () => {
    if (accountId === '' || selectedRows.length === 0) return;
    const names = selectedRows.map((r) => `#${r.new_invoice_no}  ${money(r.amount)}`).join('\n');
    const withoutDocs = selectedRows.filter((r) => r.files.length === 0);
    const warning = withoutDocs.length
      ? `\n\n⚠ No documents on: ${withoutDocs.map((r) => '#' + r.new_invoice_no).join(', ')}`
      : '';
    const question = `Process ${selectedRows.length} invoice${selectedRows.length === 1 ? '' : 's'} (${money(selectedTotal)})?\n\n${names}${warning}`;
    if (!window.confirm(question)) return;
    setProcessing(true);
    setListStatus(null);
    try {
      const done = await processRevisedInvoices({ accountId, ids: selectedRows.map((r) => r.id) });
      setListStatus({
        ok: true,
        text: `Processed ${done.processed} invoice${done.processed === 1 ? '' : 's'}, ${money(done.total)}.`,
      });
      await loadList();
      onChanged();
    } catch (err) {
      setListStatus({ ok: false, text: err instanceof Error ? err.message : 'Processing failed' });
    } finally {
      setProcessing(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-muted">
        No client has a portal login yet. Set one up on the Clients tab.
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <form onSubmit={(e) => void search(e)} className="flex flex-wrap gap-2">
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(Number(e.target.value));
            setMatches(null);
            setSelected(null);
            setFamily(null);
          }}
          className={`${inputClass} sm:w-60`}
          aria-label="Client"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Invoice #, load #, or customer"
          className={`${inputClass} min-w-[200px] flex-1`}
          aria-label="Invoice number, load number or customer"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded-lg btn-primary px-5 py-2 text-sm disabled:opacity-60"
        >
          {searching ? 'Searching…' : 'Find'}
        </button>
      </form>

      {matches && matches.length === 0 && <p className="text-sm text-red">No invoice found.</p>}

      {matches && matches.length > 1 && !selected && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {matches.map((m) => (
            <li key={m.invoiceKey}>
              <button
                type="button"
                onClick={() => void choose(m)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-0.5 px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <span className="w-28 font-semibold text-ink">#{m.invoiceNo}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{m.debtorName}</span>
                <span className="text-xs text-muted">PO {m.poId || '—'}</span>
                <span className="text-xs text-ink">{money(m.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <span className="text-base font-semibold text-ink">#{baseNo}</span>
              <span className="ml-2 text-sm text-muted">{selected.debtorName}</span>
              {matches && matches.length > 1 && (
                <button type="button" onClick={() => setSelected(null)} className="ml-3 text-xs text-accent hover:underline">
                  change
                </button>
              )}
            </div>
            <div className="text-sm text-muted">
              {family === null ? 'Loading…' : members.length > 1 ? `${members.map((m) => money(m.amount)).join(' + ')} = ` : ''}
              {family !== null && <span className="font-semibold text-ink">{money(familyTotal)}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">New</span>
              <span className="font-mono text-sm font-semibold text-accent">{family ? newInvoiceNo : '…'}</span>
            </div>
            <div className="relative w-40">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={difference}
                onChange={(e) => setDifference(e.target.value)}
                placeholder="Difference"
                className={`${inputClass} pl-6 tabular-nums`}
                aria-label="Difference amount"
              />
            </div>
            {differenceOk && family && (
              <span className="text-sm text-muted">
                Total <span className="font-semibold text-ink">{money(familyTotal + differenceNum)}</span>
              </span>
            )}
          </div>

          <FileChooser files={files} onChange={setFiles} disabled={creating} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={creating || !differenceOk || family === null || !basePo || !filesOk}
              onClick={() => void create()}
              className="rounded-lg btn-primary px-5 py-2 text-sm disabled:opacity-60"
            >
              {creating ? 'Creating…' : files.length > 0 ? `Create and upload ${files.length}` : 'Create invoice'}
            </button>
            {family !== null && !basePo && <span className="text-sm text-red">No PO number on this invoice.</span>}
            {!filesOk && <span className="text-sm text-red">A file is over 16 MB.</span>}
          </div>
        </div>
      )}

      {status && <p className={`text-sm ${status.ok ? 'text-green' : 'text-red'}`}>{status.text}</p>}

      {list.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">
            Waiting to process <span className="font-normal text-muted">({list.length})</span>
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.map((row) => (
              <WaitingRow
                key={row.id}
                accountId={accountId as number}
                row={row}
                checked={checked.has(row.id)}
                busy={processing}
                onToggle={(value) =>
                  setChecked((current) => {
                    const next = new Set(current);
                    if (value) next.add(row.id);
                    else next.delete(row.id);
                    return next;
                  })
                }
                onRemove={() => void remove(row)}
                onUploaded={loadList}
              />
            ))}
          </ul>
          <button
            type="button"
            disabled={processing || selectedRows.length === 0}
            onClick={() => void process()}
            className="rounded-lg btn-primary px-5 py-2 text-sm disabled:opacity-60"
          >
            {processing ? 'Processing…' : `Process ${selectedRows.length} · ${money(selectedTotal)}`}
          </button>
        </div>
      )}
      {listStatus && <p className={`text-sm ${listStatus.ok ? 'text-green' : 'text-red'}`}>{listStatus.text}</p>}
    </div>
  );
}

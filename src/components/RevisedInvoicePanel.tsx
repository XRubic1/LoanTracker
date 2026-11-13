import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtDateTime } from '@/lib/utils';
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

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-widest text-label';
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Documents attached to one created invoice, plus a way to add more. */
function RevisedDocuments({
  accountId,
  row,
  disabled,
  onUploaded,
}: {
  accountId: number;
  row: RevisedInvoice;
  disabled: boolean;
  onUploaded: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const add = (list: FileList | File[]) =>
    setFiles((current) => {
      const known = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...[...list].filter((f) => !known.has(`${f.name}:${f.size}`))];
    });

  const upload = async () => {
    if (files.length === 0) return;
    if (!window.confirm(`Upload ${files.length} document${files.length === 1 ? '' : 's'} to invoice #${row.new_invoice_no}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await uploadRevisedDocuments({ accountId, id: row.id, files });
      setMessage({ ok: true, text: `Uploaded ${files.length} document${files.length === 1 ? '' : 's'}.` });
      setFiles([]);
      await onUploaded();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="basis-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
      >
        <span className="inline-block w-2">{open ? '▾' : '▸'}</span>
        Documents ({row.files.length})
        {row.files.length === 0 && <span className="ml-1 text-red">none yet</span>}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-surface p-3">
          {row.files.length > 0 && (
            <ul className="space-y-0.5 text-xs text-ink">
              {row.files.map((name) => (
                <li key={name} className="truncate">
                  {name}
                </li>
              ))}
            </ul>
          )}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(e.dataTransfer.files);
            }}
            onClick={() => input.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs ${
              dragging ? 'border-accent bg-accent/5 text-ink' : 'border-border text-muted hover:border-accent'
            }`}
          >
            Drop the revised documents for #{row.new_invoice_no} here, or click to choose (up to 16 MB each)
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
            <ul className="divide-y divide-border rounded-lg border border-border text-xs">
              {files.map((file) => (
                <li key={`${file.name}:${file.size}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="min-w-0 truncate text-ink">{file.name}</span>
                  <button type="button" onClick={() => setFiles((c) => c.filter((x) => x !== file))} className="text-muted hover:text-red">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={disabled || busy || files.length === 0 || files.some((f) => f.size > 16 * 1024 * 1024)}
              onClick={() => void upload()}
              className="rounded-lg btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {busy ? 'Uploading…' : `Upload ${files.length || ''} document${files.length === 1 ? '' : 's'}`.replace('  ', ' ')}
            </button>
            {message && <span className={`text-xs ${message.ok ? 'text-green' : 'text-red'}`}>{message.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Find the invoice, enter the difference, create the revised invoice, then process the ones you created. */
export function RevisedInvoicePanel({ accounts, onChanged }: { accounts: PortalAccount[]; onChanged: () => void }) {
  const [accountId, setAccountId] = useState<number | ''>(accounts[0]?.id ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [poId, setPoId] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PortalInvoice[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PortalInvoice | null>(null);
  const [difference, setDifference] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [list, setList] = useState<RevisedInvoice[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  /** Invoices the list has already shown, so only new ones start checked. */
  const knownIds = useRef<Set<number>>(new Set());
  const [processMessage, setProcessMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (accountId === '' && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const loadList = useCallback(async () => {
    if (accountId === '') return;
    try {
      const { revised } = await listRevisedInvoices(accountId);
      // Newly created invoices start checked, as they have to be on the portal's schedule page.
      const fresh = new Set(revised.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id));
      revised.forEach((r) => knownIds.current.add(r.id));
      setList(revised);
      setListError(null);
      setChecked((current) => {
        const next = new Set<number>();
        for (const r of revised) {
          if (r.in_portal && (fresh.has(r.id) || current.has(r.id))) next.add(r.id);
        }
        return next;
      });
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not load the list');
    }
  }, [accountId]);

  useEffect(() => {
    setList([]);
    knownIds.current = new Set();
    setChecked(new Set());
    setProcessMessage(null);
    void loadList();
  }, [loadList]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (accountId === '') return;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    setCreateMessage(null);
    try {
      const { invoices } = await searchPortalInvoices({ accountId, invoice: invoiceNo, debtorName: customer, poId });
      setMatches(invoices);
      if (invoices.length === 1) setSelected(invoices[0]);
    } catch (err) {
      setMatches(null);
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const differenceNum = difference.trim() ? Math.round(parseFloat(difference) * 100) / 100 : NaN;
  const differenceOk = Number.isFinite(differenceNum) && differenceNum > 0;
  const alreadyRevised = selected ? /r$/i.test(selected.invoiceNo) : false;

  const create = async () => {
    if (accountId === '' || !selected || !differenceOk) return;
    const newNo = `${selected.invoiceNo}R`;
    const newPo = `${selected.poId}R`;
    const question =
      `Create revised invoice #${newNo}?\n\nBroker: ${selected.debtorName}\nPO: ${newPo}\nAmount: ${money(differenceNum)}\n\n` +
      'It will be created in the TruFunding portal and wait on the schedule list until you process it.';
    if (!window.confirm(question)) return;
    setCreating(true);
    setCreateMessage(null);
    try {
      const { revised } = await createRevisedInvoice({
        accountId,
        invoice: selected,
        amount: differenceNum,
        description,
      });
      setCreateMessage({ ok: true, text: `Created invoice #${revised.new_invoice_no} for ${money(revised.amount)}.` });
      setDifference('');
      setDescription('');
      setSelected(null);
      setMatches(null);
      await loadList();
      onChanged();
    } catch (err) {
      setCreateMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not create the invoice' });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (row: RevisedInvoice) => {
    if (accountId === '') return;
    const question = row.in_portal
      ? `Remove invoice #${row.new_invoice_no} (${money(row.amount)}) from the portal's schedule list?`
      : `Remove #${row.new_invoice_no} from this list? It is no longer on the portal's schedule list.`;
    if (!window.confirm(question)) return;
    setRemoving(row.id);
    setProcessMessage(null);
    try {
      await removeRevisedInvoice({ accountId, id: row.id });
      setChecked((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      await loadList();
      onChanged();
    } catch (err) {
      setProcessMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not remove the invoice' });
    } finally {
      setRemoving(null);
    }
  };

  const selectedRows = list.filter((r) => r.in_portal && checked.has(r.id));
  const selectedTotal = selectedRows.reduce((sum, r) => sum + r.amount, 0);

  const process = async () => {
    if (accountId === '' || selectedRows.length === 0) return;
    const names = selectedRows.map((r) => `#${r.new_invoice_no}  ${money(r.amount)}`).join('\n');
    const question =
      `Process ${selectedRows.length} revised invoice${selectedRows.length === 1 ? '' : 's'}, ${money(selectedTotal)} in total?\n\n` +
      `${names}\n\nThis submits them to TruFunding for processing. Only the invoices listed here are included.`;
    const withoutDocs = selectedRows.filter((r) => r.files.length === 0);
    const warning = withoutDocs.length
      ? `\n\n⚠ No documents are attached to: ${withoutDocs.map((r) => '#' + r.new_invoice_no).join(', ')}.`
      : '';
    if (!window.confirm(question + warning)) return;
    setProcessing(true);
    setProcessMessage(null);
    try {
      const done = await processRevisedInvoices({ accountId, ids: selectedRows.map((r) => r.id) });
      setProcessMessage({
        ok: true,
        text: `Processed ${done.processed} invoice${done.processed === 1 ? '' : 's'}, ${money(done.total)}. ${done.message}`,
      });
      await loadList();
      onChanged();
    } catch (err) {
      setProcessMessage({ ok: false, text: err instanceof Error ? err.message : 'Processing failed' });
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

  const hasQuery = Boolean(invoiceNo.trim() || customer.trim() || poId.trim());

  return (
    <div className="space-y-6 px-4 py-4">
      <div className="space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-label">1 · Find the invoice</p>
        <form onSubmit={(e) => void search(e)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Client</label>
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(Number(e.target.value));
                  setMatches(null);
                  setSelected(null);
                }}
                className={inputClass}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Invoice #</label>
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="33473" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Customer (broker)</label>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>PO / load #</label>
              <input value={poId} onChange={(e) => setPoId(e.target.value)} className={inputClass} />
            </div>
          </div>
          <button
            type="submit"
            disabled={searching || !hasQuery}
            className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {searching ? 'Searching…' : 'Find invoice'}
          </button>
        </form>

        {searchError && <p className="text-sm text-red">{searchError}</p>}

        {matches && (
          <div className="space-y-2">
            <p className={`text-sm font-medium ${matches.length === 0 ? 'text-red' : 'text-green'}`}>
              {matches.length === 0
                ? 'No invoice found. Check the invoice number, load number and customer, then search again.'
                : matches.length === 1
                  ? 'Invoice found.'
                  : `${matches.length} invoices found. Pick the right one.`}
            </p>
            {matches.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {matches.map((m) => (
                  <li key={m.invoiceKey}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(m);
                        setCreateMessage(null);
                      }}
                      className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left text-sm ${
                        selected?.invoiceKey === m.invoiceKey ? 'bg-accent/10' : 'hover:bg-surface'
                      }`}
                    >
                      <span className="w-20 font-semibold text-ink">#{m.invoiceNo}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{m.debtorName}</span>
                      <span className="text-xs text-muted">PO {m.poId || '—'}</span>
                      <span className="text-xs text-muted">{m.invoiceDate ?? ''}</span>
                      <span className="text-xs text-muted">
                        {money(m.amount)} · balance {money(m.balance)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-label">2 · Enter the difference</p>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Broker</dt>
              <dd className="font-medium text-ink">{selected.debtorName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Original invoice</dt>
              <dd className="font-medium text-ink">
                #{selected.invoiceNo} · {money(selected.amount)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">New invoice #</dt>
              <dd className="font-mono font-medium text-accent">{selected.invoiceNo}R</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">New PO #</dt>
              <dd className="font-mono font-medium text-accent">{selected.poId ? `${selected.poId}R` : '—'}</dd>
            </div>
          </dl>
          {alreadyRevised && <p className="text-sm text-red">This is already a revised invoice.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Difference amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={difference}
                onChange={(e) => setDifference(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description (optional)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={creating || !differenceOk || alreadyRevised || !selected.poId}
              onClick={() => void create()}
              className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create invoice'}
            </button>
            {!selected.poId && <span className="text-sm text-red">This invoice has no PO number.</span>}
          </div>
        </div>
      )}
      {createMessage && <p className={`text-sm ${createMessage.ok ? 'text-green' : 'text-red'}`}>{createMessage.text}</p>}

      <div className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-label">
          3 · Created invoices waiting to be processed
          <span className="ml-2 font-normal normal-case tracking-normal text-muted">{list.length}</span>
        </p>
        {listError && <p className="text-sm text-red">{listError}</p>}
        {list.length === 0 && !listError && (
          <p className="text-sm text-muted">No revised invoices are waiting. Create one above.</p>
        )}
        {list.length > 0 && (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {list.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Process invoice ${row.new_invoice_no}`}
                    checked={row.in_portal && checked.has(row.id)}
                    disabled={!row.in_portal || processing}
                    onChange={(e) =>
                      setChecked((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      })
                    }
                  />
                  <span className="w-24 font-semibold text-ink">#{row.new_invoice_no}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{row.broker}</span>
                  <span className="text-xs text-muted">PO {row.po_no}</span>
                  <span className="font-medium text-ink">{money(row.amount)}</span>
                  <span className="text-xs text-muted">
                    {row.created_by ?? ''} · {fmtDateTime(row.created_at)}
                  </span>
                  {!row.in_portal && (
                    <span className="text-xs text-red" title="Processed or removed in the portal itself">
                      No longer on the portal's list
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={processing || removing === row.id}
                    onClick={() => void remove(row)}
                    className="text-xs text-muted hover:text-red disabled:opacity-60"
                  >
                    {removing === row.id ? '…' : 'Remove'}
                  </button>
                  {row.in_portal && accountId !== '' && (
                    <RevisedDocuments
                      accountId={accountId}
                      row={row}
                      disabled={processing}
                      onUploaded={() => loadList()}
                    />
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={processing || selectedRows.length === 0}
                onClick={() => void process()}
                className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {processing
                  ? 'Processing…'
                  : `Process ${selectedRows.length} selected · ${money(selectedTotal)}`}
              </button>
              <span className="text-xs text-muted">Only invoices created here are listed, and only checked ones are processed.</span>
            </div>
          </>
        )}
        {processMessage && (
          <p className={`text-sm ${processMessage.ok ? 'text-green' : 'text-red'}`}>{processMessage.text}</p>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { fmtDateTime } from '@/lib/utils';
import {
  fetchPortalBatches,
  fetchPortalUploads,
  searchPortalInvoices,
  uploadInvoiceFiles,
  uploadToPortal,
  type PortalAccount,
  type PortalBatchOption,
  type PortalInvoice,
  type PortalUploadLogEntry,
  type PortalUploadOverview,
} from '@/lib/portalUpload';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-widest text-label';

function formatSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function UploadPanel({ accounts, onUploaded }: { accounts: PortalAccount[]; onUploaded: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<number | ''>(accounts[0]?.id ?? '');
  const [batches, setBatches] = useState<PortalBatchOption[] | null>(null);
  const [batchId, setBatchId] = useState<'new' | number>('new');
  const [files, setFiles] = useState<File[]>([]);
  const [processAfter, setProcessAfter] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (accountId === '' && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const loadBatches = async () => {
    if (accountId === '') return;
    setResult(null);
    try {
      setBatches((await fetchPortalBatches(accountId)).batches);
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Could not load batches' });
    }
  };

  const addFiles = (list: FileList | File[]) =>
    setFiles((current) => {
      const known = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...[...list].filter((f) => !known.has(`${f.name}:${f.size}`))];
    });

  const hasExcel = files.some((f) => /\.xlsx?$/i.test(f.name));
  const account = accounts.find((a) => a.id === accountId);

  const upload = async () => {
    if (accountId === '' || files.length === 0) return;
    const target = batchId === 'new' ? 'a new batch' : `batch ${batches?.find((b) => b.id === batchId)?.batch_no ?? ''}`;
    const question =
      `Upload ${files.length} file${files.length === 1 ? '' : 's'} to ${target} for ${account?.label}?` +
      (processAfter ? '\n\nThe batch will also be PROCESSED in the portal right away.' : '');
    if (!window.confirm(question)) return;
    setBusy(true);
    setResult(null);
    try {
      const done = await uploadToPortal({ accountId, batchId, process: processAfter, files });
      setResult({ ok: true, text: `Batch ${done.batch_no}: ${done.message}` });
      setFiles([]);
      setBatches(null);
      setBatchId('new');
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setBusy(false);
      onUploaded();
    }
  };

  if (accounts.length === 0) {
    return <div className="px-4 py-8 text-center text-[12px] text-muted">No client has a portal login yet. Set one up on the Clients tab.</div>;
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Client</label>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(Number(e.target.value));
              setBatches(null);
              setBatchId('new');
            }}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} ({a.username})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Batch</label>
          <div className="flex gap-2">
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value === 'new' ? 'new' : Number(e.target.value))}
              className={inputClass}
            >
              <option value="new">Create a new batch</option>
              {(batches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  Batch {b.batch_no}
                  {b.note ? ` · ${b.note}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadBatches()}
              className="whitespace-nowrap rounded-lg border border-border px-3 text-xs text-muted hover:text-ink"
            >
              Open batches
            </button>
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm ${
          dragging ? 'border-accent bg-accent/5 text-ink' : 'border-border text-muted hover:border-accent'
        }`}
      >
        Drop the revised invoice files here, or click to choose
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {files.map((file) => (
            <li key={`${file.name}:${file.size}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">{file.name}</span>
              <span className="flex flex-shrink-0 items-center gap-3 text-xs text-muted">
                {formatSize(file.size)}
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                  className="hover:text-red"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={processAfter}
          onChange={(e) => setProcessAfter(e.target.checked)}
          className="mt-1"
        />
        <span>
          Process the batch after uploading
          <span className="block text-[11px] text-muted">
            Leave this off to upload only and review in the portal first. The portal needs at least one Excel file
            to process.
            {processAfter && !hasExcel && files.length > 0 && (
              <span className="text-red"> No Excel file is selected.</span>
            )}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled
          title="Revised invoice upload is not available yet"
          onClick={() => void upload()}
          className="rounded-lg btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Uploading…' : `Upload ${files.length || ''} file${files.length === 1 ? '' : 's'}`.replace('  ', ' ')}
        </button>
        <span className="text-xs text-muted">Coming soon</span>
        {result && <span className={`text-sm ${result.ok ? 'text-green' : 'text-red'}`}>{result.text}</span>}
      </div>
    </div>
  );
}

const money = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Find one invoice by customer and invoice number, then add documents to it. */
function InvoiceUploadPanel({ accounts, onUploaded }: { accounts: PortalAccount[]; onUploaded: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<number | ''>(accounts[0]?.id ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [poId, setPoId] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PortalInvoice[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PortalInvoice | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (accountId === '' && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const account = accounts.find((a) => a.id === accountId);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (accountId === '') return;
    setSearching(true);
    setSearchError(null);
    setResult(null);
    setSelected(null);
    try {
      const { invoices } = await searchPortalInvoices({
        accountId,
        invoice: invoiceNo,
        debtorName: customer,
        poId,
      });
      setMatches(invoices);
      if (invoices.length === 1) setSelected(invoices[0]);
    } catch (err) {
      setMatches(null);
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const addFiles = (list: FileList | File[]) =>
    setFiles((current) => {
      const known = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...[...list].filter((f) => !known.has(`${f.name}:${f.size}`))];
    });

  const upload = async () => {
    if (accountId === '' || !selected || files.length === 0) return;
    const question = `Upload ${files.length} file${files.length === 1 ? '' : 's'} to invoice ${selected.invoiceNo} (${selected.debtorName}) for ${account?.label}?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setResult(null);
    try {
      const done = await uploadInvoiceFiles({ accountId, invoice: selected, files });
      setResult({ ok: true, text: done.message });
      setFiles([]);
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setBusy(false);
      onUploaded();
    }
  };

  if (accounts.length === 0) {
    return <div className="px-4 py-8 text-center text-[12px] text-muted">No client has a portal login yet. Set one up on the Clients tab.</div>;
  }

  const hasQuery = Boolean(invoiceNo.trim() || customer.trim() || poId.trim());

  return (
    <div className="space-y-4 px-4 py-4">
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
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="C.H. Robinson" className={inputClass} />
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
              ? 'No invoice found. Check the invoice number and customer, then search again.'
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
                    onClick={() => setSelected(m)}
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

      {selected && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${
              dragging ? 'border-accent bg-accent/5 text-ink' : 'border-border text-muted hover:border-accent'
            }`}
          >
            Drop documents for invoice #{selected.invoiceNo} here, or click to choose (up to 16 MB each)
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {files.map((file) => (
                <li key={`${file.name}:${file.size}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-ink">{file.name}</span>
                  <span className="flex flex-shrink-0 items-center gap-3 text-xs text-muted">
                    {formatSize(file.size)}
                    <button type="button" onClick={() => setFiles((c) => c.filter((f) => f !== file))} className="hover:text-red">
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || files.length === 0 || files.some((f) => f.size > 16 * 1024 * 1024)}
              onClick={() => void upload()}
              className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {busy ? 'Uploading…' : `Upload to invoice #${selected.invoiceNo}`}
            </button>
            {result && <span className={`text-sm ${result.ok ? 'text-green' : 'text-red'}`}>{result.text}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** Past uploads, folded away until opened. Each shows who uploaded it. */
export function RecentUploads({
  entries,
  title = 'Recent uploads',
}: {
  entries: PortalUploadLogEntry[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-[11px] text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.04em] text-ink">
          <span className="inline-block w-2">{open ? '▾' : '▸'}</span>
          {title}
          <span className="count-badge">{entries.length}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-border">
          {entries.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-muted">Nothing uploaded yet.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">
                    {entry.account_label}
                    {entry.batch_no ? (
                      <span className="font-normal text-muted">
                        {' '}
                        · {/^\d+$/.test(entry.batch_no) ? `Batch ${entry.batch_no}` : entry.batch_no}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted" title={entry.file_names.join(', ')}>
                    {entry.file_names.join(', ')}
                  </div>
                  {entry.message && <div className="mt-0.5 text-xs text-muted">{entry.message}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted">
                  <div className="flex gap-1.5">
                    {entry.processed && <Badge variant="ok">Processed</Badge>}
                    <Badge variant={entry.status === 'success' ? 'ok' : 'overdue'}>
                      {entry.status === 'success' ? (entry.batch_no?.startsWith('Download') ? 'Downloaded' : 'Uploaded') : 'Failed'}
                    </Badge>
                  </div>
                  <span className="text-ink">By {entry.uploaded_by || 'unknown'}</span>
                  <span>{fmtDateTime(entry.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

export function UploadPage() {
  const [tab, setTab] = useState<'revised' | 'invoice'>('invoice');
  const [overview, setOverview] = useState<PortalUploadOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await fetchPortalUploads());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load uploads');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accounts = overview?.accounts ?? [];
  const log = overview?.log ?? [];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Upload</h1>
      </div>
      <p className="text-sm text-muted2">
        Upload documents to a client's TruFunding portal. Set each client's portal login on the Clients tab.
      </p>
      {error && <p className="rounded-lg border border-red/30 bg-tag-overdue px-3 py-2 text-sm text-tag-overdue-fg">{error}</p>}

      <div className="flex gap-1 border-b border-border" role="tablist">
        {(
          [
            ['invoice', 'Invoice documents'],
            ['revised', 'Revised invoices'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            disabled={id === 'revised'}
            title={id === 'revised' ? 'Revised invoices is not available yet' : undefined}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted`}
          >
            {label}
            {id === 'revised' && <span className="ml-2 text-[10px] uppercase tracking-wide">Soon</span>}
          </button>
        ))}
      </div>

      {tab === 'revised' ? (
        <>
          <Section title="Upload revised invoices" noPadding>
            <UploadPanel accounts={accounts} onUploaded={() => void load()} />
          </Section>
          <RecentUploads entries={log.filter((e) => /^\d+$/.test(e.batch_no ?? ''))} />
        </>
      ) : (
        <>
          <Section title="Upload to an invoice" noPadding>
            <InvoiceUploadPanel accounts={accounts} onUploaded={() => void load()} />
          </Section>
          <RecentUploads entries={log.filter((e) => !/^\d+$/.test(e.batch_no ?? '') && !e.batch_no?.startsWith('Download'))} />
        </>
      )}
    </div>
  );
}

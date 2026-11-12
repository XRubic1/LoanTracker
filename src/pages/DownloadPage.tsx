import { useCallback, useEffect, useState } from 'react';
import { Section } from '@/components/Section';
import { RecentUploads } from '@/pages/UploadPage';
import { mergeIntoOnePdf } from '@/lib/mergeInvoicePdf';
import {
  downloadPortalInvoiceFile,
  fetchPortalInvoiceFile,
  saveBlob,
  fetchPortalUploads,
  listPortalInvoiceFiles,
  searchPortalInvoices,
  type PortalAccount,
  type PortalInvoice,
  type PortalInvoiceFileInfo,
  type PortalUploadOverview,
} from '@/lib/portalUpload';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-widest text-label';

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Find one invoice, see its documents, and download them. */
function InvoiceDownloadPanel({ accounts, onDownloaded }: { accounts: PortalAccount[]; onDownloaded: () => void }) {
  const [accountId, setAccountId] = useState<number | ''>(accounts[0]?.id ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [poId, setPoId] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PortalInvoice[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PortalInvoice | null>(null);
  const [files, setFiles] = useState<PortalInvoiceFileInfo[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [downloading, setDownloading] = useState<number | 'all' | 'merged' | null>(null);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (accountId === '' && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const loadFiles = useCallback(async (account: number, invoice: PortalInvoice) => {
    setLoadingFiles(true);
    setFiles(null);
    setFilesError(null);
    setDownloadError(null);
    setMergeNote(null);
    try {
      setFiles((await listPortalInvoiceFiles({ accountId: account, invoice })).files);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Could not load the documents');
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const select = (invoice: PortalInvoice) => {
    setSelected(invoice);
    if (accountId !== '') void loadFiles(accountId, invoice);
  };

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (accountId === '') return;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    setFiles(null);
    try {
      const { invoices } = await searchPortalInvoices({ accountId, invoice: invoiceNo, debtorName: customer, poId });
      setMatches(invoices);
      if (invoices.length === 1) select(invoices[0]);
    } catch (err) {
      setMatches(null);
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  /** Fetch every document and save them as a single PDF. */
  const downloadMerged = async (which: PortalInvoiceFileInfo[]) => {
    if (accountId === '' || !selected) return;
    setDownloading('merged');
    setDownloadError(null);
    setMergeNote(null);
    try {
      const inputs = [];
      for (const file of which) {
        inputs.push({
          fileName: file.file_name,
          blob: await fetchPortalInvoiceFile({ accountId, invoice: selected, file }),
        });
      }
      const merged = await mergeIntoOnePdf(inputs);
      if (merged.pages === 0) throw new Error('None of the documents could be combined into a PDF.');
      const customer = selected.debtorName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
      saveBlob(merged.blob, `Invoice_${selected.invoiceNo}${customer ? `_${customer}` : ''}.pdf`);
      setMergeNote(
        `Combined ${inputs.length - merged.skipped.length} document${inputs.length - merged.skipped.length === 1 ? '' : 's'} into one PDF (${merged.pages} pages).` +
          (merged.skipped.length ? ` Left out (not PDF or image): ${merged.skipped.join(', ')}.` : '')
      );
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'The download failed');
    } finally {
      setDownloading(null);
      onDownloaded();
    }
  };

  const download = async (which: PortalInvoiceFileInfo[], marker: number | 'all') => {
    if (accountId === '' || !selected) return;
    setDownloading(marker);
    setDownloadError(null);
    try {
      for (const file of which) {
        await downloadPortalInvoiceFile({ accountId, invoice: selected, file });
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'The download failed');
    } finally {
      setDownloading(null);
      onDownloaded();
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
                setFiles(null);
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
                    onClick={() => select(m)}
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">
              Documents on invoice #{selected.invoiceNo}
              {files ? <span className="font-normal text-muted"> · {files.length}</span> : null}
            </p>
            {files && files.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {files.length > 1 && (
                  <button
                    type="button"
                    disabled={downloading != null}
                    onClick={() => void download(files, 'all')}
                    className="text-xs text-muted2 underline hover:text-ink disabled:opacity-60"
                  >
                    {downloading === 'all' ? 'Downloading…' : `Download ${files.length} separately`}
                  </button>
                )}
                <button
                  type="button"
                  disabled={downloading != null}
                  onClick={() => void downloadMerged(files)}
                  className="rounded-lg btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {downloading === 'merged' ? 'Combining…' : 'Download as one PDF'}
                </button>
              </div>
            )}
          </div>
          {loadingFiles && <p className="text-sm text-muted">Loading documents…</p>}
          {filesError && <p className="text-sm text-red">{filesError}</p>}
          {files && files.length === 0 && (
            <p className="text-sm text-muted">This invoice has no documents attached.</p>
          )}
          {files && files.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {files.map((file) => (
                <li key={file.image_key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-ink">{file.file_name}</span>
                  <button
                    type="button"
                    disabled={downloading != null}
                    onClick={() => void download([file], file.image_key)}
                    className="flex-shrink-0 rounded-lg border border-border px-3 py-1 text-xs text-accent hover:border-accent disabled:opacity-60"
                  >
                    {downloading === file.image_key ? 'Downloading…' : 'Download'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mergeNote && <p className="text-sm text-green">{mergeNote}</p>}
          {downloadError && <p className="text-sm text-red">{downloadError}</p>}
        </div>
      )}
    </div>
  );
}

export function DownloadPage() {
  const [overview, setOverview] = useState<PortalUploadOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await fetchPortalUploads());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accounts = overview?.accounts ?? [];
  const downloads = (overview?.log ?? []).filter((e) => e.batch_no?.startsWith('Download'));

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Download</h1>
      </div>
      <p className="text-sm text-muted2">
        Find an invoice in a client's TruFunding portal by invoice number, load number or customer, then download its
        documents.
      </p>
      {error && (
        <p className="rounded-lg border border-red/30 bg-tag-overdue px-3 py-2 text-sm text-tag-overdue-fg">{error}</p>
      )}

      <Section title="Download invoice documents" noPadding>
        <InvoiceDownloadPanel accounts={accounts} onDownloaded={() => void load()} />
      </Section>

      <RecentUploads entries={downloads} title="Recent downloads" />
    </div>
  );
}

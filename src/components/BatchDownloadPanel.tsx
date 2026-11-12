import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { mergeIntoOnePdf } from '@/lib/mergeInvoicePdf';
import {
  downloadPortalInvoiceFile,
  fetchBatchInvoicePackage,
  findPortalBatch,
  listPortalInvoiceFiles,
  logBatchDownload,
  saveBlob,
  type PortalAccount,
  type PortalBatchInvoiceRow,
  type PortalInvoice,
  type PortalInvoiceFileInfo,
  type PortalPurchaseBatch,
} from '@/lib/portalUpload';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-widest text-label';
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const CONCURRENCY = 3;

const safeName = (text: string) => text.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

function bytesFromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** One invoice in the batch. Opening it shows its documents, as the portal's invoice page does. */
function BatchInvoiceRow({
  accountId,
  row,
  open,
  onToggle,
}: {
  accountId: number;
  row: PortalBatchInvoiceRow;
  open: boolean;
  onToggle: () => void;
}) {
  const [files, setFiles] = useState<PortalInvoiceFileInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const invoice: PortalInvoice = {
    invoiceKey: row.invoice_key,
    invoiceNo: row.invoice_no,
    debtorName: row.customer,
    poId: '',
    amount: row.amount,
    balance: 0,
    invoiceDate: null,
    batchNo: '',
  };

  useEffect(() => {
    if (!open || files) return;
    setError(null);
    listPortalInvoiceFiles({ accountId, invoice })
      .then((result) => setFiles(result.files))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the documents'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left text-sm hover:bg-surface"
      >
        <span className="inline-block w-2 text-muted">{open ? '▾' : '▸'}</span>
        <span className="w-20 font-semibold text-accent">#{row.invoice_no}</span>
        <span className="min-w-0 flex-1 truncate text-ink">{row.customer}</span>
        <span className="text-xs text-muted">{money(row.amount)}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-border bg-surface px-6 py-2">
          {!files && !error && <p className="text-xs text-muted">Loading documents…</p>}
          {error && <p className="text-xs text-red">{error}</p>}
          {files && files.length === 0 && <p className="text-xs text-muted">No documents on this invoice.</p>}
          {files?.map((file) => (
            <div key={file.image_key} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-ink">{file.file_name}</span>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => {
                  setBusy(file.image_key);
                  downloadPortalInvoiceFile({ accountId, invoice, file })
                    .catch((err) => setError(err instanceof Error ? err.message : 'The download failed'))
                    .finally(() => setBusy(null));
                }}
                className="flex-shrink-0 text-accent hover:underline disabled:opacity-60"
              >
                {busy === file.image_key ? 'Downloading…' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

/** Find a purchase batch, list its invoices, and download all their paperwork as one ZIP. */
export function BatchDownloadPanel({ accounts, onDownloaded }: { accounts: PortalAccount[]; onDownloaded: () => void }) {
  const cancelRef = useRef(false);
  const [accountId, setAccountId] = useState<number | ''>(accounts[0]?.id ?? '');
  const [batchNo, setBatchNo] = useState('');
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ info: PortalPurchaseBatch; invoices: PortalBatchInvoiceRow[] } | null>(null);
  const [openKey, setOpenKey] = useState<number | null>(null);
  const [combine, setCombine] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string; details?: string[] } | null>(null);

  useEffect(() => {
    if (accountId === '' && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const find = async (event: React.FormEvent) => {
    event.preventDefault();
    if (accountId === '') return;
    setFinding(true);
    setFindError(null);
    setBatch(null);
    setResult(null);
    setOpenKey(null);
    try {
      const found = await findPortalBatch({ accountId, batchNo });
      setBatch({ info: found.batch, invoices: found.invoices });
    } catch (err) {
      setFindError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setFinding(false);
    }
  };

  const downloadZip = async () => {
    if (accountId === '' || !batch) return;
    const { info, invoices } = batch;
    cancelRef.current = false;
    setResult(null);
    setProgress({ done: 0, total: invoices.length });

    const zip = new JSZip();
    const folder = zip.folder(`Batch_${info.batch_no}`) as JSZip;
    const problems: string[] = [];
    let documents = 0;
    let invoicesWithDocs = 0;
    let done = 0;
    let cursor = 0;

    const worker = async () => {
      while (!cancelRef.current) {
        const row = invoices[cursor];
        cursor += 1;
        if (!row) return;
        try {
          const pkg = await fetchBatchInvoicePackage({ accountId, transKey: info.trans_key, invoiceKey: row.invoice_key });
          const label = `Invoice_${safeName(pkg.invoice_no)}${row.customer ? `_${safeName(row.customer)}` : ''}`;
          if (pkg.files.length === 0) {
            problems.push(`Invoice ${pkg.invoice_no}: no documents on the invoice`);
          } else if (combine) {
            const merged = await mergeIntoOnePdf(
              pkg.files.map((f) => ({ fileName: f.file_name, blob: new Blob([bytesFromBase64(f.data)]) }))
            );
            if (merged.pages > 0) {
              folder.file(`${label}.pdf`, merged.blob);
              documents += pkg.files.length - merged.skipped.length;
              invoicesWithDocs += 1;
            } else {
              problems.push(`Invoice ${pkg.invoice_no}: documents could not be combined`);
            }
            for (const name of merged.skipped) problems.push(`Invoice ${pkg.invoice_no}: left out ${name}`);
          } else {
            const sub = folder.folder(label) as JSZip;
            for (const f of pkg.files) sub.file(f.file_name, bytesFromBase64(f.data));
            documents += pkg.files.length;
            invoicesWithDocs += 1;
          }
        } catch (err) {
          problems.push(`Invoice ${row.invoice_no}: ${err instanceof Error ? err.message : 'failed'}`);
        }
        done += 1;
        setProgress({ done, total: invoices.length });
      }
    };

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (cancelRef.current) {
        setResult({ ok: false, text: 'Cancelled. Nothing was downloaded.' });
        return;
      }
      if (invoicesWithDocs === 0) {
        setResult({ ok: false, text: 'No documents were found in this batch.', details: problems });
        return;
      }
      if (problems.length) {
        folder.file('_report.txt', `Batch ${info.batch_no}\n\nNot included:\n${problems.map((p) => `- ${p}`).join('\n')}\n`);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      saveBlob(blob, `Batch_${info.batch_no}.zip`);
      const text = `Downloaded ${invoicesWithDocs} of ${invoices.length} invoices (${documents} documents) as Batch_${info.batch_no}.zip.`;
      setResult({ ok: true, text, details: problems });
      await logBatchDownload({
        accountId,
        batchNo: info.batch_no,
        message: `${text}${problems.length ? ` ${problems.length} item${problems.length === 1 ? '' : 's'} not included.` : ''}`,
      }).catch(() => {});
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'The download failed' });
    } finally {
      setProgress(null);
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

  const running = progress != null;

  return (
    <div className="space-y-4 px-4 py-4">
      <form onSubmit={(e) => void find(e)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Client</label>
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(Number(e.target.value));
                setBatch(null);
              }}
              disabled={running}
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
            <label className={labelClass}>Batch #</label>
            <input
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="130469"
              disabled={running}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={finding || running || !batchNo.trim()}
          className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {finding ? 'Searching…' : 'Find batch'}
        </button>
      </form>

      {findError && <p className="text-sm text-red">{findError}</p>}

      {batch && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-green">
            Batch found: {batch.invoices.length} invoice{batch.invoices.length === 1 ? '' : 's'}
            <span className="font-normal text-muted">
              {' '}
              · {batch.info.post_date ?? ''} · check {money(batch.info.check_amount)} · {batch.info.status}
            </span>
          </p>

          <ul className="max-h-[360px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {batch.invoices.map((row) => (
              <BatchInvoiceRow
                key={row.invoice_key}
                accountId={accountId as number}
                row={row}
                open={openKey === row.invoice_key}
                onToggle={() => setOpenKey((current) => (current === row.invoice_key ? null : row.invoice_key))}
              />
            ))}
          </ul>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} disabled={running} className="mt-1" />
            <span>
              Combine each invoice's documents into one PDF
              <span className="block text-[11px] text-muted">
                Off: each invoice gets its own folder with the original files.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={running || batch.invoices.length === 0}
              onClick={() => void downloadZip()}
              className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {running ? 'Downloading…' : `Download batch ${batch.info.batch_no} as ZIP`}
            </button>
            {running && (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="text-xs text-muted2 underline hover:text-ink"
              >
                Cancel
              </button>
            )}
          </div>

          {progress && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                Invoice {progress.done} of {progress.total}
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-1">
              <p className={`text-sm ${result.ok ? 'text-green' : 'text-red'}`}>{result.text}</p>
              {result.details && result.details.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
                  {result.details.slice(0, 20).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                  {result.details.length > 20 && <li>…and {result.details.length - 20} more (see _report.txt in the ZIP)</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

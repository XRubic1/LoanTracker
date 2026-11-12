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
/** Folder size limit when splitting a batch (bytes). */
const FOLDER_LIMIT_BYTES = 90 * 1024 * 1024;

interface PendingFile {
  /** Path inside the invoice's slot: a PDF name, or folder/file name. */
  path: string;
  data: Blob | Uint8Array;
  size: number;
}

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
  const [splitFolders, setSplitFolders] = useState(false);
  const [singlePdf, setSinglePdf] = useState(false);
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
    /** Files per invoice, kept in batch order so folders fill predictably. */
    const collected: PendingFile[][] = invoices.map(() => []);
    const problems: string[] = [];
    let documents = 0;
    let invoicesWithDocs = 0;
    let done = 0;
    let cursor = 0;

    const worker = async () => {
      while (!cancelRef.current) {
        const index = cursor;
        const row = invoices[index];
        cursor += 1;
        if (!row) return;
        try {
          const pkg = await fetchBatchInvoicePackage({ accountId, transKey: info.trans_key, invoiceKey: row.invoice_key });
          const label = `Invoice_${safeName(pkg.invoice_no)}${row.customer ? `_${safeName(row.customer)}` : ''}`;
          if (pkg.files.length === 0) {
            problems.push(`Invoice ${pkg.invoice_no}: no documents on the invoice`);
          } else if (combine || singlePdf) {
            const merged = await mergeIntoOnePdf(
              pkg.files.map((f) => ({ fileName: f.file_name, blob: new Blob([bytesFromBase64(f.data)]) }))
            );
            if (merged.pages > 0) {
              collected[index].push({ path: `${label}.pdf`, data: merged.blob, size: merged.blob.size });
              documents += pkg.files.length - merged.skipped.length;
              invoicesWithDocs += 1;
            } else {
              problems.push(`Invoice ${pkg.invoice_no}: documents could not be combined`);
            }
            for (const name of merged.skipped) problems.push(`Invoice ${pkg.invoice_no}: left out ${name}`);
          } else {
            for (const f of pkg.files) {
              const bytes = bytesFromBase64(f.data);
              collected[index].push({ path: `${label}/${f.file_name}`, data: bytes, size: bytes.length });
            }
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
      const exportedAmount = invoices.reduce((sum, row, i) => (collected[i].length ? sum + row.amount : sum), 0);
      const batchAmount = invoices.reduce((sum, row) => sum + row.amount, 0);
      const amountNote =
        exportedAmount === batchAmount ? money(exportedAmount) : `${money(exportedAmount)} of ${money(batchAmount)}`;
      const noteProblems = problems.length ? ` ${problems.length} item${problems.length === 1 ? '' : 's'} not included.` : '';

      // One PDF for the whole batch: every invoice's pages, in batch order.
      if (singlePdf) {
        const everything = await mergeIntoOnePdf(
          collected.flatMap((files) => files.map((file) => ({ fileName: file.path, blob: file.data as Blob })))
        );
        saveBlob(everything.blob, `Batch_${info.batch_no}.pdf`);
        const text = `Exported ${invoicesWithDocs} of ${invoices.length} invoices, ${amountNote} (${documents} documents, ${everything.pages} pages) as one PDF, Batch_${info.batch_no}.pdf.`;
        setResult({ ok: true, text, details: problems });
        await logBatchDownload({ accountId, batchNo: info.batch_no, message: `${text}${noteProblems}` }).catch(() => {});
        return;
      }

      // Keep each invoice's paperwork together; start a new folder when the next invoice would pass the limit.
      let part = 1;
      let partSize = 0;
      let parts = 1;
      collected.forEach((files, index) => {
        if (files.length === 0) return;
        const invoiceSize = files.reduce((n, file) => n + file.size, 0);
        if (splitFolders && partSize > 0 && partSize + invoiceSize > FOLDER_LIMIT_BYTES) {
          part += 1;
          partSize = 0;
        }
        partSize += invoiceSize;
        parts = Math.max(parts, part);
        const target = splitFolders ? (folder.folder(`Part_${String(part).padStart(2, '0')}`) as JSZip) : folder;
        for (const file of files) target.file(file.path, file.data);
        if (splitFolders && invoiceSize > FOLDER_LIMIT_BYTES) {
          problems.push(`Invoice ${invoices[index].invoice_no}: its documents alone are over 90 MB, so it has a folder to itself`);
        }
      });
      if (problems.length) {
        folder.file('_report.txt', `Batch ${info.batch_no}\n\nNot included:\n${problems.map((p) => `- ${p}`).join('\n')}\n`);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      saveBlob(blob, `Batch_${info.batch_no}.zip`);
      const text =
        `Exported ${invoicesWithDocs} of ${invoices.length} invoices, ${amountNote} (${documents} documents) as Batch_${info.batch_no}.zip` +
        `${splitFolders ? `, split into ${parts} folder${parts === 1 ? '' : 's'} of up to 90 MB` : ''}.`;
      setResult({ ok: true, text, details: problems });
      await logBatchDownload({
        accountId,
        batchNo: info.batch_no,
        message: `${text}${noteProblems}`,
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
            <input
              type="checkbox"
              checked={combine || singlePdf}
              onChange={(e) => setCombine(e.target.checked)}
              disabled={running || singlePdf}
              className="mt-1"
            />
            <span>
              Combine each invoice's documents into one PDF
              <span className="block text-[11px] text-muted">
                Off: each invoice gets its own folder with the original files.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={singlePdf}
              onChange={(e) => setSinglePdf(e.target.checked)}
              disabled={running}
              className="mt-1"
            />
            <span>
              Combine the whole batch into one PDF
              <span className="block text-[11px] text-muted">
                One file, Batch_{batch.info.batch_no}.pdf, with every invoice in order instead of a ZIP. Very large
                batches can take a while to build.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={splitFolders && !singlePdf}
              onChange={(e) => setSplitFolders(e.target.checked)}
              disabled={running || singlePdf}
              className="mt-1"
            />
            <span>
              Split into folders of up to 90 MB
              <span className="block text-[11px] text-muted">
                Creates Part_01, Part_02 and so on inside the ZIP. An invoice's paperwork is never split across folders.
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
              {running ? 'Downloading…' : singlePdf ? `Download batch ${batch.info.batch_no} as one PDF` : `Download batch ${batch.info.batch_no} as ZIP`}
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

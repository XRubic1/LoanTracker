import { useCallback, useEffect, useRef, useState } from 'react';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { fmtDateTime } from '@/lib/utils';
import {
  DEFAULT_PORTAL_URL,
  deletePortalAccount,
  fetchPortalBatches,
  fetchPortalUploads,
  savePortalAccount,
  searchPortalInvoices,
  uploadInvoiceFiles,
  uploadToPortal,
  type PortalAccount,
  type PortalBatchOption,
  type PortalInvoice,
  type PortalUploadOverview,
} from '@/lib/portalUpload';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-widest text-label';

function formatSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** Add or edit one saved client login. The password is checked against the portal before it is saved. */
function AccountForm({
  account,
  onSaved,
  onCancel,
}: {
  account: PortalAccount | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(account?.label ?? '');
  const [username, setUsername] = useState(account?.username ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await savePortalAccount({
        id: account?.id,
        label,
        username,
        password: password || undefined,
        portal_url: account?.portal_url ?? DEFAULT_PORTAL_URL,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 border-b border-border px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Client</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Client name" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Portal username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Portal password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={account ? 'Leave blank to keep' : ''}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted">
        The login is tested on the portal when you save. The password is stored encrypted and is never shown again.
      </p>
      {error && <p className="text-sm text-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !label.trim() || !username.trim() || (!account && !password)}
          className="rounded-lg btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {saving ? 'Testing login…' : 'Save login'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
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
    return <div className="px-4 py-8 text-center text-[12px] text-muted">Add a client login above to start uploading.</div>;
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Client portal</label>
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
          disabled={busy || files.length === 0 || (processAfter && !hasExcel)}
          onClick={() => void upload()}
          className="rounded-lg btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {busy ? 'Uploading…' : `Upload ${files.length || ''} file${files.length === 1 ? '' : 's'}`.replace('  ', ' ')}
        </button>
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
    return <div className="px-4 py-8 text-center text-[12px] text-muted">Add a client login above to start uploading.</div>;
  }

  const hasQuery = Boolean(invoiceNo.trim() || customer.trim() || poId.trim());

  return (
    <div className="space-y-4 px-4 py-4">
      <form onSubmit={(e) => void search(e)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Client portal</label>
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

export function UploadPage() {
  const [overview, setOverview] = useState<PortalUploadOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PortalAccount | 'new' | null>(null);

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

  const remove = async (account: PortalAccount) => {
    if (!window.confirm(`Remove the saved login for ${account.label}?`)) return;
    try {
      await deletePortalAccount(account.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove');
    }
  };

  const accounts = overview?.accounts ?? [];
  const canManage = overview?.canManage ?? false;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="page-title">Upload</h1>
      </div>
      <p className="text-sm text-muted2">
        Save each client's portal login once, then drop their revised invoices here. Files go straight into a
        TruFunding Purchase Import batch.
      </p>
      {error && <p className="rounded-lg border border-red/30 bg-tag-overdue px-3 py-2 text-sm text-tag-overdue-fg">{error}</p>}

      <Section title="Client logins" count={accounts.length} noPadding>
        {editing && canManage && (
          <AccountForm
            key={editing === 'new' ? 'new' : editing.id}
            account={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
        {accounts.length === 0 && !editing ? (
          <div className="px-4 py-6 text-center text-[12px] text-muted">No client logins saved yet.</div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{account.label}</div>
                <div className="text-xs text-muted">
                  {account.username} · {account.portal_url.replace('https://', '')}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => setEditing(account)} className="text-accent hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => void remove(account)} className="text-muted hover:text-red">
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {canManage && !editing && (
          <div className="px-4 py-3">
            <button type="button" onClick={() => setEditing('new')} className="rounded-lg btn-primary px-3 py-1.5 text-xs">
              + Add client login
            </button>
          </div>
        )}
      </Section>

      <Section title="Upload invoices" noPadding>
        <UploadPanel accounts={accounts} onUploaded={() => void load()} />
      </Section>

      <Section title="Upload to an invoice" noPadding>
        <InvoiceUploadPanel accounts={accounts} onUploaded={() => void load()} />
      </Section>

      <Section title="Recent uploads" count={overview?.log.length ?? 0} noPadding>
        {!overview || overview.log.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-muted">Nothing uploaded yet.</div>
        ) : (
          overview.log.map((entry) => (
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
                    {entry.status === 'success' ? 'Uploaded' : 'Failed'}
                  </Badge>
                </div>
                <span>
                  {fmtDateTime(entry.created_at)}
                  {entry.uploaded_by ? ` · ${entry.uploaded_by}` : ''}
                </span>
              </div>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

/** TruFunding ClientWeb portal: login, batches, file upload, process. Same calls the portal's own page makes. */

/** Constant the portal's own web app sends with every call. */
const PORTAL_CODE = 'dnCFStezzga';
const FETCH_TIMEOUT_MS = 60_000;

export interface PortalSession {
  base: string;
  username: string;
  clientNo: string;
  token: string;
  /** Key the portal's own pages send when saving images to an invoice. */
  apiKey: string;
}

export interface PortalInvoice {
  invoiceKey: number;
  invoiceNo: string;
  debtorName: string;
  poId: string;
  amount: number;
  balance: number;
  invoiceDate: string | null;
  batchNo: string;
}

export interface PortalBatch {
  BatchUploadId: number;
  BatchNo: string;
  ClientKey?: string | number | null;
  Note?: string | null;
  StatusBatch?: string | null;
}

/** Only the portal's own host may receive saved credentials. */
export function normalizePortalUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') return null;
    if (!(url.hostname === 'trufunding.net' || url.hostname.endsWith('.trufunding.net'))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function request(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function postJson(base: string, path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await request(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json' },
    body: JSON.stringify({ data: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Portal returned an unexpected response (${response.status}).`);
  }
  if (!response.ok) throw new Error(`Portal error ${response.status}.`);
  return data;
}

export async function portalLogin(base: string, username: string, password: string): Promise<PortalSession> {
  const data = await postJson(base, '/api/UserLogin', {
    username,
    password,
    ModuleName: 'FACTORSOFTLOGISTIC',
    CallerId: 'FactorSoftClientWeb',
    code_in: PORTAL_CODE,
  });
  if (String(data.StatusResponse) !== '1') {
    throw new Error(String(data.InfoResponse || 'Portal login failed. Check the username and password.'));
  }
  return { base, username, clientNo: String(data.ClientNo ?? ''),
    token: String(data.Token ?? ''),
    apiKey: String(data.ApiKey ?? ''),
  };
}

export async function listBatches(session: PortalSession, processed = false): Promise<PortalBatch[]> {
  const query = JSON.stringify({
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
    CallMode: processed ? '2' : '1',
  });
  const response = await request(
    `${session.base}/api/BatchUploadFeedUrl_trufunding?source=clBatchUpload&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Could not list batches (${response.status}).`);
  const data = (await response.json().catch(() => null)) as unknown;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((data as { Data?: unknown; data?: unknown }).Data ?? (data as { data?: unknown }).data)
      : null;
  return Array.isArray(rows) ? (rows as PortalBatch[]) : [];
}

/** Create a new empty batch and return it (the portal only answers with a message, so diff the batch list). */
export async function createBatch(session: PortalSession): Promise<PortalBatch> {
  const before = new Set((await listBatches(session)).map((b) => b.BatchUploadId));
  const result = await postJson(session.base, '/api/createBatch', {
    ClientNo: session.clientNo,
    username: session.username,
    code: PORTAL_CODE,
    callmode: 'CreatingBetch',
  });
  if (String(result.StatusResponse) !== '1') {
    throw new Error(String(result.InfoResponse || 'Could not create a batch.'));
  }
  const created = (await listBatches(session)).filter((b) => !before.has(b.BatchUploadId));
  const batch = created.sort((a, b) => b.BatchUploadId - a.BatchUploadId)[0];
  if (!batch) throw new Error('The batch was created but could not be found in the portal.');
  return batch;
}

export async function uploadToBatch(session: PortalSession, batch: PortalBatch, file: File): Promise<void> {
  const form = new FormData();
  form.append('uploadedFile', file, file.name);
  const params = new URLSearchParams({
    user: session.clientNo,
    shipment_number: `BATCH_${batch.BatchNo}`,
    clientKey: String(batch.ClientKey ?? ''),
  });
  const response = await request(`${session.base}/Home/UploadDocuments?${params}`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Upload of ${file.name} failed (${response.status}).`);
}

export async function processBatch(session: PortalSession, batch: PortalBatch): Promise<string> {
  const result = await postJson(session.base, '/api/BatchUploadAction', {
    ID: batch.BatchUploadId,
    Action: 'PROCESS',
    code: PORTAL_CODE,
  });
  if (String(result.StatusResponse) !== '1') {
    throw new Error(String(result.InfoResponse || 'The portal could not process the batch.'));
  }
  return String(result.InfoResponse ?? 'Processed');
}

/** The portal sends dates as /Date(1782882000000)/. */
function portalDate(value: unknown): string | null {
  const ms = Number(String(value ?? '').match(/-?\d+/)?.[0]);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : null;
}

const usDate = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;

/** Search this client's invoices by invoice number, customer (debtor) name or PO. Open and paid invoices are included. */
export async function searchInvoices(
  session: PortalSession,
  filter: { invoice?: string; debtorName?: string; poId?: string }
): Promise<PortalInvoice[]> {
  const query = JSON.stringify({
    DateFrom: '01/01/2015',
    DateTo: usDate(new Date(Date.now() + 366 * 24 * 60 * 60 * 1000)),
    invoice: filter.invoice?.trim() ?? '',
    debtorName: filter.debtorName?.trim() ?? '',
    PoId: filter.poId?.trim() ?? '',
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
    callmode: 'SEARCH',
    agingmin: 0,
    agingmax: 0,
    showAll: 1,
  });
  const response = await request(
    `${session.base}/api/cl_invoicesUrl_trufunding?source=cl_invoices&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Invoice search failed (${response.status}).`);
  const data = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).slice(0, 100).map((row) => ({
    invoiceKey: Number(row.InvoiceKey),
    invoiceNo: String(row.InvoiceNo ?? '').trim(),
    debtorName: String(row.DebtorName ?? '').trim(),
    poId: String(row.PoId ?? '').trim(),
    amount: Number(row.InvoiceAmt ?? 0),
    balance: Number(row.InvoiceBal ?? 0),
    invoiceDate: portalDate(row.InvoiceDate),
    batchNo: String(row.BatchNo ?? ''),
  }));
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Largest file the portal's own invoice upload accepts in one call. */
export const MAX_INVOICE_IMAGE_BYTES = 16 * 1024 * 1024;

/** Same call as the "Upload images" button on an invoice page. */
export async function uploadInvoiceImage(session: PortalSession, invoiceKey: number, file: File): Promise<void> {
  const result = await postJson(session.base, '/api/UploadInvoiceImages', {
    username: session.username,
    token: session.apiKey,
    applicationId: 'TRUFUNDING',
    action: 'UPLOAD_IMAGE',
    refKey: invoiceKey,
    note: 'upload image',
    dataInput: JSON.stringify({
      base64String: base64(new Uint8Array(await file.arrayBuffer())),
      FileName: file.name,
      FileType: file.type,
    }),
  });
  if (String(result.StatusResponse) !== '1') {
    throw new Error(String(result.InfoResponse || `The portal rejected ${file.name}.`));
  }
}

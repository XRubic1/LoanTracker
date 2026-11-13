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
  debtorKey: number;
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
    debtorKey: Number(row.DebtorKey ?? 0),
    amount: Number(row.InvoiceAmt ?? 0),
    balance: Number(row.InvoiceBal ?? 0),
    invoiceDate: portalDate(row.InvoiceDate),
    batchNo: String(row.BatchNo ?? ''),
  }));
}

export function base64(bytes: Uint8Array): string {
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

export interface PortalInvoiceFile {
  imageKey: number;
  fileName: string;
  url: string;
}

/** Documents attached to an invoice, as the invoice page lists them. */
export async function listInvoiceFiles(session: PortalSession, invoiceKey: number): Promise<PortalInvoiceFile[]> {
  const query = JSON.stringify({
    InvoiceKey: invoiceKey,
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
  });
  const response = await request(
    `${session.base}/api/invoicesdetailsImagesUrl_trufunding?source=invoicedetailsimages&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Could not list the invoice documents (${response.status}).`);
  const data = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];

  const files: PortalInvoiceFile[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const fileName = String(row.FileName ?? '').trim();
    // The portal serves these over http; the same address works over https.
    const url = String(row.TmpPath ?? '').trim().replace(/^http:\/\//i, 'https://');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    // Only fetch files from the portal's own TMP_Images folder.
    if (!fileName || parsed.origin !== session.base || !parsed.pathname.startsWith('/TMP_Images/')) continue;
    files.push({ imageKey: Number(row.ImageKey), fileName, url });
  }
  return files;
}

/** Largest document the app will relay in one download. */
export const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;

export async function fetchInvoiceFile(file: PortalInvoiceFile): Promise<Uint8Array> {
  const response = await request(file.url, { headers: { Accept: '*/*' } });
  if (!response.ok) throw new Error(`The portal could not send ${file.fileName} (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error(`${file.fileName} is larger than 40 MB.`);
  return bytes;
}

export interface PortalBatchSummary {
  transKey: number;
  batchNo: number;
  postDate: string | null;
  checkAmount: number;
  status: string;
  invoiceCount: number;
}

export interface PortalBatchInvoice {
  invoiceKey: number;
  invoiceNo: string;
  customer: string;
  amount: number;
}

async function scheduleRows(session: PortalSession, from: string, to: string): Promise<Record<string, unknown>[]> {
  const query = JSON.stringify({
    DateFrom: from,
    DateTo: to,
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
    callmode: 'SCHEDULE',
  });
  const response = await request(
    `${session.base}/api/purchasedschedule_trufunding?source=purchasedschedule&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Could not look up the batch (${response.status}).`);
  const data = (await response.json().catch(() => null)) as unknown;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

/** Find a purchase batch (the portal's "BatchNo") for this client. The portal caps a list at 1000 rows, so look year by year if needed. */
export async function findBatch(session: PortalSession, batchNo: number): Promise<PortalBatchSummary | null> {
  const now = new Date();
  const windows: [string, string][] = [['01/01/2015', usDate(new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000))]];
  for (let year = now.getUTCFullYear() + 1; year >= 2015; year -= 1) windows.push([`01/01/${year}`, `12/31/${year}`]);

  for (const [from, to] of windows) {
    const rows = await scheduleRows(session, from, to);
    const hit = rows.find((r) => Number(r.BatchNo) === batchNo);
    if (hit) {
      return {
        transKey: Number(hit.TransKey),
        batchNo: Number(hit.BatchNo),
        postDate: portalDate(hit.PostDate),
        checkAmount: Number(hit.CheckAmt ?? 0),
        status: String(hit.TransStatus ?? ''),
        invoiceCount: Number(hit.NumberOfInvoices ?? 0),
      };
    }
    // A list under the cap holds everything in its window, so older windows need no further search.
    if (rows.length < 1000 && from === windows[0][0]) break;
  }
  return null;
}

export async function listBatchInvoices(session: PortalSession, transKey: number): Promise<PortalBatchInvoice[]> {
  const query = JSON.stringify({
    TransKey: String(transKey),
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
  });
  const response = await request(
    `${session.base}/api/purchasedscheduledetails_trufunding?source=purchasedscheduledetails&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Could not list the batch invoices (${response.status}).`);
  const data = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    invoiceKey: Number(row.InvoiceKey),
    invoiceNo: String(row.InvNo ?? '').trim(),
    customer: String(row.Name ?? '').trim(),
    amount: Number(row.Amt ?? 0),
  }));
}

// ---- revised invoices: create in the portal, list what is waiting, remove, process ----

export interface PortalInvoiceInput {
  invoiceInputId: number;
  invoiceNo: string;
  poNo: string;
  amount: number;
  broker: string;
  status: string;
}

/** Invoices created in the portal that have not been processed yet (the make-schedule list). */
export async function listPendingInvoiceInputs(session: PortalSession): Promise<PortalInvoiceInput[]> {
  const query = JSON.stringify({
    InvoiceInputId: 0,
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
    CallMode: '1',
  });
  const response = await request(
    `${session.base}/api/InvoiceInputFeedUrl_trufunding?source=clInvoiceInput&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`Could not read the schedule list (${response.status}).`);
  const data = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    invoiceInputId: Number(row.InvoiceInputId),
    invoiceNo: String(row.Inv_Id ?? '').trim(),
    poNo: String(row.Po_No ?? '').trim(),
    amount: Number(row.InvAmt ?? 0),
    broker: String(row.DebName ?? '').trim(),
    status: String(row.StatusInvoice ?? ''),
  }));
}

async function portalGet(session: PortalSession, path: string, source: string, query: Record<string, unknown>) {
  const response = await request(
    `${session.base}/api/${path}?source=${source}&data=${encodeURIComponent(JSON.stringify(query))}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`The portal could not answer (${response.status}).`);
  return (await response.json().catch(() => null)) as unknown;
}

/** The client's own details, as the create-invoice page loads them. */
async function clientDetails(session: PortalSession): Promise<{ clientKey: number; name: string }> {
  const data = await portalGet(session, 'ClientInfo_trufunding', 'GETCLIENIFO', {
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row || !row.ClientKey) throw new Error('Could not read the client details from the portal.');
  return { clientKey: Number(row.ClientKey), name: String(row.Name ?? '') };
}

/** The broker's address, as the create-invoice page builds it. */
async function debtorAddress(session: PortalSession, debtorKey: number): Promise<{ name: string; addr1: string; addr2: string }> {
  const data = await portalGet(session, 'debtorinfo_trufunding', 'getdebtorinfo', {
    DebtorKey: debtorKey,
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
  });
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) throw new Error('Could not read the broker details from the portal.');
  const addr2 = `${row.City ?? ''}, ${row.State ?? ''}, ${row.ZipCode ?? ''}`.trim();
  return { name: String(row.Name ?? ''), addr1: String(row.Addr1 ?? ''), addr2 };
}

const usDateToday = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

export interface CreatedRevisedInvoice {
  invoiceInputId: number;
  newInvoiceNo: string;
  poNo: string;
  broker: string;
}

/**
 * Create the revised invoice exactly as the portal's "create invoice" page does: same broker, the PO and
 * invoice number with an R added, and one line for the difference amount.
 */
export async function createRevisedInvoice(
  session: PortalSession,
  original: PortalInvoice,
  amount: number,
  description: string,
  newInvoiceNo: string,
  poNo: string
): Promise<CreatedRevisedInvoice> {
  if (!original.debtorKey) throw new Error('The invoice has no broker on file, so it cannot be revised here.');
  const [client, debtor] = await Promise.all([clientDetails(session), debtorAddress(session, original.debtorKey)]);
  const broker = debtor.name || original.debtorName;

  const header = {
    Inv_id: newInvoiceNo,
    Inv_Date: usDateToday(),
    Po_No: poNo,
    InvAmt: amount,
    DebName: broker,
    Addr1: debtor.addr1,
    Addr2: debtor.addr2,
    ClientKey: client.clientKey,
    ShipmentNum: '',
    UserName: session.username,
    DebtorKey: original.debtorKey,
    Name: client.name,
  };
  const result = await postJson(session.base, '/api/CreateInvoice', {
    Master: JSON.stringify(header),
    Details: JSON.stringify([{ Description: description, Amount: amount, Qyt: 1 }]),
    GeneratePDF: JSON.stringify([
      {
        ClientKey: client.clientKey,
        username: session.username,
        ClientNo: session.clientNo,
        callmode: 'PRINT',
        token: session.token,
      },
    ]),
  });
  // The portal answers "2" when it refuses the invoice.
  if (String(result.StatusResponse) === '2') {
    throw new Error(String(result.InfoResponse || 'The portal did not create the invoice.'));
  }

  let invoiceInputId = parseInt(String(result.ExtraInfoResponse ?? ''), 10);
  if (!Number.isFinite(invoiceInputId)) {
    const pending = await listPendingInvoiceInputs(session);
    const match = pending
      .filter((p) => p.invoiceNo === newInvoiceNo)
      .sort((a, b) => b.invoiceInputId - a.invoiceInputId)[0];
    if (!match) throw new Error('The invoice may have been created, but it could not be found in the portal.');
    invoiceInputId = match.invoiceInputId;
  }
  return { invoiceInputId, newInvoiceNo, poNo, broker };
}

/** Delete an unprocessed invoice, like the delete button on the schedule page. */
export async function deleteInvoiceInput(session: PortalSession, invoiceInputId: number): Promise<void> {
  const result = await postJson(session.base, '/api/deleteInvoice', { InvoiceInputId: invoiceInputId });
  if (String(result.StatusResponse) !== '1') {
    throw new Error(String(result.InfoResponse || 'The portal could not remove the invoice.'));
  }
}

/** Submit the chosen invoices for processing, like the Process button on the schedule page. */
export async function createSchedule(session: PortalSession, invoiceInputIds: number[]): Promise<string> {
  const shipmentNum = Math.floor(Date.now() / 1000);
  const rows = invoiceInputIds.map((id) => JSON.stringify({ InvoiceInputId: id, ShipmentNum: shipmentNum }));
  const result = await postJson(session.base, '/api/createschedule', rows as unknown as Record<string, unknown>);
  if (String(result.StatusResponse) !== '1') {
    throw new Error(String(result.InfoResponse || 'The portal could not process the invoices.'));
  }
  return String(result.InfoResponse ?? 'Processed');
}

/** Names of the documents already attached to an unprocessed (created) invoice. */
export async function listInvoiceInputFiles(session: PortalSession, invoiceInputId: number): Promise<string[]> {
  const query = JSON.stringify({
    InvoiceInputId: invoiceInputId,
    username: session.username,
    token: session.token,
    ClientNo: session.clientNo,
    CallMode: 'CREATESCHEDULE_UNPROCESSED',
  });
  const response = await request(
    `${session.base}/api/InvoiceInputFeedUrl_trufunding?source=clInvoiceInput&data=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) return [];
  const data = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];
  const row = (data as Record<string, unknown>[]).find((r) => Number(r.InvoiceInputId) === invoiceInputId);
  const images = row && Array.isArray(row.Invoice_LIST_images) ? (row.Invoice_LIST_images as Record<string, unknown>[]) : [];
  return images.map((i) => String(i.FileName ?? '')).filter(Boolean);
}

/** Attach documents to a created invoice, one request per file, like the create-invoice page's upload. */
export async function uploadToInvoiceInput(session: PortalSession, invoiceInputId: number, files: File[]): Promise<void> {
  const shipmentNum = Math.floor(Date.now() / 1000);
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const result = await postJson(session.base, '/api/FactorsoftUploadforCreateInvoice', {
      user: session.username,
      token: session.apiKey,
      ShipmentNum: shipmentNum,
      FileName: file.name,
      extra_info: file.type,
      sequence_number: i + 1,
      total_files: files.length,
      base64String: base64(new Uint8Array(await file.arrayBuffer())),
      InvoiceInputId: invoiceInputId,
    });
    if (String(result.StatusResponse) !== '1') {
      throw new Error(String(result.InfoResponse || `The portal rejected ${file.name}.`));
    }
  }
}

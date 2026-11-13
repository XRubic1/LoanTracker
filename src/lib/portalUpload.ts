import { getSupabase } from '@/lib/supabase';
import { prepareForPortal } from './shrinkForPortal';

export interface PortalAccount {
  id: number;
  /** The client (Clients tab) this login belongs to. */
  client_id: number | null;
  /** False for logins saved by another team: they can be used to upload, not changed. */
  can_edit: boolean;
  label: string;
  portal_url: string;
  username: string;
}

export interface PortalUploadLogEntry {
  id: number;
  account_label: string;
  batch_no: string | null;
  file_names: string[];
  processed: boolean;
  status: 'success' | 'failed';
  message: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PortalBatchOption {
  id: number;
  batch_no: string;
  note: string;
}

export interface PortalInvoice {
  invoiceKey: number;
  invoiceNo: string;
  debtorName: string;
  poId: string;
  debtorKey?: number;
  amount: number;
  balance: number;
  invoiceDate: string | null;
  batchNo: string;
}

export interface PortalPurchaseBatch {
  trans_key: number;
  batch_no: number;
  post_date: string | null;
  check_amount: number;
  status: string;
}

export interface PortalBatchInvoiceRow {
  invoice_key: number;
  invoice_no: string;
  customer: string;
  amount: number;
}

export interface PortalUploadOverview {
  accounts: PortalAccount[];
  log: PortalUploadLogEntry[];
  /** Only the account owner may add or remove saved logins. */
  canManage: boolean;
}

export const DEFAULT_PORTAL_URL = 'https://clients.trufunding.net';

async function errorMessage(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.clone !== 'function') return null;
  try {
    const body = (await ctx.clone().json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

async function call<T>(body: Record<string, unknown> | FormData): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('portal-upload', { body });
  const payload = data as (T & { error?: string }) | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error((await errorMessage(error)) ?? 'The upload service is not reachable.');
  return payload as T;
}

export const fetchPortalUploads = () => call<PortalUploadOverview>({ action: 'list' });

export const savePortalAccount = (input: {
  id?: number;
  client_id?: number;
  label: string;
  username: string;
  password?: string;
  portal_url?: string;
}) => call<{ account: PortalAccount }>({ action: 'save', ...input });

export const deletePortalAccount = (id: number) => call<{ ok: true }>({ action: 'delete', id });

export const fetchPortalBatches = (accountId: number) =>
  call<{ batches: PortalBatchOption[] }>({ action: 'batches', accountId });

export function uploadToPortal(input: {
  accountId: number;
  batchId: 'new' | number;
  process: boolean;
  files: File[];
}) {
  const form = new FormData();
  form.append('action', 'upload');
  form.append('accountId', String(input.accountId));
  form.append('batchId', String(input.batchId));
  form.append('process', String(input.process));
  for (const file of input.files) form.append('files', file, file.name);
  return call<{ batch_no: string; processed: boolean; message: string }>(form);
}

export const searchPortalInvoices = (input: {
  accountId: number;
  invoice?: string;
  debtorName?: string;
  poId?: string;
}) => call<{ invoices: PortalInvoice[] }>({ action: 'invoice_search', ...input });

export async function uploadInvoiceFiles(input: { accountId: number; invoice: PortalInvoice; files: File[] }) {
  const prepared = await prepareForPortal(input.files);
  const form = new FormData();
  form.append('action', 'invoice_upload');
  form.append('accountId', String(input.accountId));
  form.append('invoiceKey', String(input.invoice.invoiceKey));
  form.append('invoiceNo', input.invoice.invoiceNo);
  for (const file of prepared.files) form.append('files', file, file.name);
  const result = await call<{ invoice_no: string; message: string }>(form);
  return prepared.notes.length ? { ...result, message: `${result.message} (${prepared.notes.join('; ')}.)` } : result;
}

export interface PortalInvoiceFileInfo {
  image_key: number;
  file_name: string;
}

export const listPortalInvoiceFiles = (input: { accountId: number; invoice: PortalInvoice }) =>
  call<{ files: PortalInvoiceFileInfo[] }>({
    action: 'invoice_files',
    accountId: input.accountId,
    invoiceKey: input.invoice.invoiceKey,
    invoiceNo: input.invoice.invoiceNo,
  });

/** Fetch one document from the portal. */
export async function fetchPortalInvoiceFile(input: {
  accountId: number;
  invoice: PortalInvoice;
  file: PortalInvoiceFileInfo;
  /** Set when the file is one piece of a combined PDF that is logged separately. */
  skipLog?: boolean;
}): Promise<Blob> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('portal-upload', {
    body: {
      action: 'invoice_download',
      accountId: input.accountId,
      invoiceKey: input.invoice.invoiceKey,
      invoiceNo: input.invoice.invoiceNo,
      imageKey: input.file.image_key,
      skipLog: input.skipLog === true,
    },
  });
  if (error) throw new Error((await errorMessage(error)) ?? 'The download failed.');
  if (!(data instanceof Blob)) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message ?? 'The download failed.');
  }
  return data;
}

/** Hand a file to the browser as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadPortalInvoiceFile(input: {
  accountId: number;
  invoice: PortalInvoice;
  file: PortalInvoiceFileInfo;
}): Promise<void> {
  saveBlob(await fetchPortalInvoiceFile(input), input.file.file_name);
}

/** Record a combined-PDF download in the history as one entry. */
export const logCombinedDownload = (input: { accountId: number; invoice: PortalInvoice; fileNames: string[] }) =>
  call<{ ok: true }>({
    action: 'invoice_download_log',
    accountId: input.accountId,
    invoiceKey: input.invoice.invoiceKey,
    invoiceNo: input.invoice.invoiceNo,
    fileNames: input.fileNames,
  });

export const findPortalBatch = (input: { accountId: number; batchNo: string }) =>
  call<{ batch: PortalPurchaseBatch; invoices: PortalBatchInvoiceRow[] }>({ action: 'batch_find', ...input });

export interface BatchInvoicePackage {
  invoice_no: string;
  customer: string;
  files: { file_name: string; data: string }[];
}

export const fetchBatchInvoicePackage = (input: { accountId: number; transKey: number; invoiceKey: number }) =>
  call<BatchInvoicePackage>({ action: 'batch_invoice_package', ...input });

export const logBatchDownload = (input: { accountId: number; batchNo: number; message: string }) =>
  call<{ ok: true }>({ action: 'batch_download_log', ...input });

function blobFromBase64(data: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes]);
}

/** All requested documents of one invoice in a single request (much faster than one request per file). */
export async function fetchInvoicePackage(input: {
  accountId: number;
  invoice: PortalInvoice;
  /** Leave out to get every document on the invoice. */
  imageKeys?: number[];
  /** Write a history entry for these files. */
  log?: boolean;
}): Promise<{ fileName: string; blob: Blob }[]> {
  const result = await call<{ files: { file_name: string; data: string }[] }>({
    action: 'invoice_package',
    accountId: input.accountId,
    invoiceKey: input.invoice.invoiceKey,
    invoiceNo: input.invoice.invoiceNo,
    imageKeys: input.imageKeys,
    log: input.log === true,
  });
  return result.files.map((f) => ({ fileName: f.file_name, blob: blobFromBase64(f.data) }));
}

export interface RevisedInvoice {
  id: number;
  original_invoice_no: string;
  new_invoice_no: string;
  po_no: string;
  broker: string;
  amount: number;
  created_by: string | null;
  created_at: string;
  /** False once the invoice was processed or removed in the portal itself. */
  in_portal: boolean;
  /** Names of the documents already attached to the invoice. */
  files: string[];
}

export const listRevisedInvoices = (accountId: number) =>
  call<{ revised: RevisedInvoice[] }>({ action: 'revised_list', accountId });

export const createRevisedInvoice = (input: {
  accountId: number;
  invoice: PortalInvoice;
  amount: number;
  description?: string;
}) =>
  call<{ revised: { id: number; original_invoice_no: string; new_invoice_no: string; amount: number } }>({
    action: 'revised_create',
    accountId: input.accountId,
    invoiceKey: input.invoice.invoiceKey,
    invoiceNo: input.invoice.invoiceNo,
    amount: input.amount,
    description: input.description ?? '',
  });

export const removeRevisedInvoice = (input: { accountId: number; id: number }) =>
  call<{ ok: true }>({ action: 'revised_remove', ...input });

export const processRevisedInvoices = (input: { accountId: number; ids: number[] }) =>
  call<{ processed: number; total: number; message: string }>({ action: 'revised_process', ...input });

export async function uploadRevisedDocuments(input: { accountId: number; id: number; files: File[] }) {
  const prepared = await prepareForPortal(input.files);
  const form = new FormData();
  form.append('action', 'revised_upload');
  form.append('accountId', String(input.accountId));
  form.append('id', String(input.id));
  for (const file of prepared.files) form.append('files', file, file.name);
  return call<{ uploaded: number }>(form);
}

import { getSupabase } from '@/lib/supabase';

export interface PortalAccount {
  id: number;
  /** The client (Clients tab) this login belongs to. */
  client_id: number | null;
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
  amount: number;
  balance: number;
  invoiceDate: string | null;
  batchNo: string;
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

export function uploadInvoiceFiles(input: { accountId: number; invoice: PortalInvoice; files: File[] }) {
  const form = new FormData();
  form.append('action', 'invoice_upload');
  form.append('accountId', String(input.accountId));
  form.append('invoiceKey', String(input.invoice.invoiceKey));
  form.append('invoiceNo', input.invoice.invoiceNo);
  for (const file of input.files) form.append('files', file, file.name);
  return call<{ invoice_no: string; message: string }>(form);
}

import { getSupabase } from '@/lib/supabase';
import { aaaDueFromRow, aaaPaymentFromRow } from '@/lib/supabase-db';
import type { AaaDue, AaaDueRow, AaaPayment, AaaPaymentRow } from '@/types';

/** Everything the AAA Fuel portal shows. Row-level security limits it to AAA Mega Fuel. */
export interface AaaFuelData {
  openDues: AaaDue[];
  closedPayments: AaaPayment[];
  /** Names of every client AAA Fuel may create a payment for. */
  clients: string[];
}

export async function fetchAaaFuelData(): Promise<AaaFuelData> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const [dues, payments, clients] = await Promise.all([
    supabase
      .from('aaa_dues')
      .select('*')
      .eq('payee', 'AAA Mega Fuel')
      .is('closed_at', null)
      .order('week_start', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('aaa_payments')
      .select('*')
      .eq('payee', 'AAA Mega Fuel')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.rpc('aaa_fuel_clients'),
  ]);
  if (dues.error) throw dues.error;
  if (payments.error) throw payments.error;
  if (clients.error) throw clients.error;

  return {
    openDues: ((dues.data as AaaDueRow[]) ?? []).map(aaaDueFromRow),
    closedPayments: ((payments.data as AaaPaymentRow[]) ?? []).map((row) => aaaPaymentFromRow(row)!),
    clients: ((clients.data as { name: string }[]) ?? []).map((c) => c.name),
  };
}

/** Create a Mega Fuel payment. The database routes it to the team that owns the client. */
export async function createAaaFuelDue(input: {
  client: string;
  amount: number;
  weekStart: string;
}): Promise<AaaDue> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('aaa_fuel_create_due', {
    p_client: input.client,
    p_amount: input.amount,
    p_week_start: input.weekStart,
  });
  if (error) throw new Error(error.message);
  return aaaDueFromRow(data as AaaDueRow);
}

export interface ClientMatch {
  /** Exact (case-insensitive) match, as the canonical client name. */
  exact: string | null;
  /** Clients that start with / contain what was typed, best first. */
  suggestions: string[];
}

/** Match what the person typed against the list of Tru clients. */
export function matchTruClient(typed: string, clients: string[]): ClientMatch {
  const q = typed.trim().toLowerCase();
  if (!q) return { exact: null, suggestions: [] };
  const exact = clients.find((c) => c.trim().toLowerCase() === q) ?? null;
  const starts = clients.filter((c) => c.toLowerCase().startsWith(q));
  const contains = clients.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
  return { exact, suggestions: [...starts, ...contains].slice(0, 8) };
}

/** Post a full or partial deduction on an open Mega Fuel payment. Closes it when the full amount is reached. */
export async function postAaaFuelDeduction(
  due: AaaDue,
  deduction: { amount: number; date: string; note?: string }
): Promise<{ closed: boolean }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('aaa_fuel_post_deduction', {
    p_due_id: due.id,
    p_amount: deduction.amount,
    p_date: deduction.date,
    p_note: deduction.note ?? null,
  });
  if (error) throw new Error(error.message);
  return { closed: Boolean((data as AaaDueRow).closed_at) };
}

/** Delete an open Mega Fuel payment. Closed payments (history) cannot be deleted. */
export async function deleteAaaFuelDue(id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.rpc('aaa_fuel_delete_due', { p_due_id: id });
  if (error) throw new Error(error.message);
}

export type AaaReceiptStatus = 'received' | 'not_received' | null;

/** Calendar days between a YYYY-MM-DD date and today (local). */
function daysSince(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - then) / (24 * 60 * 60 * 1000));
}

/** Money deducted today or yesterday may still be on its way: "not received" has to wait 2 days. */
export function canMarkNotReceived(paymentDate: string): boolean {
  return daysSince(paymentDate) >= 2;
}

export const ALLOW_TWO_DAYS_MESSAGE =
  'Please allow 2 days after the deduction for the payment to arrive before marking it as not received.';

/** Mark a closed Mega Fuel payment as received, as not received, or clear the mark (null). */
export async function setAaaFuelReceipt(
  id: number,
  status: AaaReceiptStatus
): Promise<{ receivedAt: string | null; notReceivedAt: string | null }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('aaa_fuel_set_receipt', { p_payment_id: id, p_status: status });
  if (error) throw new Error(error.message);
  const row = data as AaaPaymentRow;
  return { receivedAt: row.received_at ?? null, notReceivedAt: row.not_received_at ?? null };
}

/** One invoice (weekly AAA payment) with every payment posted against it. Older records stand alone. */
export interface InvoiceGroup {
  key: string;
  dueId: number | null;
  client: string;
  weekStart: string | null;
  /** What the invoice is for (older records: what was paid). */
  total: number;
  /** Sum of the payments posted so far. */
  deducted: number;
  /** Oldest first. */
  payments: AaaPayment[];
  latestDate: string;
  received: number;
  notReceived: number;
}

/** Group payments by the invoice they belong to, newest activity first. */
export function groupPaymentsByInvoice(payments: AaaPayment[]): InvoiceGroup[] {
  const map = new Map<string, AaaPayment[]>();
  for (const p of payments) {
    const key = p.dueId != null ? `due-${p.dueId}` : `pay-${p.id}`;
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  const groups: InvoiceGroup[] = [];
  for (const [key, list] of map) {
    const sorted = [...list].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.id - b.id);
    const first = sorted[0];
    const deducted = Math.round(sorted.reduce((n, p) => n + p.amount, 0) * 100) / 100;
    groups.push({
      key,
      dueId: first.dueId ?? null,
      client: first.client,
      weekStart: first.weekStart ?? null,
      total: first.dueAmount ?? deducted,
      deducted,
      payments: sorted,
      latestDate: sorted[sorted.length - 1].paymentDate,
      received: sorted.filter((p) => p.receivedAt).length,
      notReceived: sorted.filter((p) => p.notReceivedAt).length,
    });
  }
  return groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
}

/** Whole-invoice receipt state: not received if any payment is, received when all are, else waiting. */
export function invoiceReceiptState(g: Pick<InvoiceGroup, 'payments' | 'received' | 'notReceived'>): 'received' | 'not_received' | 'waiting' {
  if (g.notReceived > 0) return 'not_received';
  if (g.payments.length > 0 && g.received === g.payments.length) return 'received';
  return 'waiting';
}

/** Mark every payment on an invoice as received / not received, or clear them (null). */
export async function setAaaFuelInvoiceReceipt(dueId: number, status: AaaReceiptStatus): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.rpc('aaa_fuel_set_invoice_receipt', { p_due_id: dueId, p_status: status });
  if (error) throw new Error(error.message);
}

/** Correct what an invoice is for. Cannot go below what has already been deducted. */
export async function editAaaFuelDueAmount(dueId: number, amount: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.rpc('aaa_fuel_edit_due_amount', { p_due_id: dueId, p_amount: amount });
  if (error) throw new Error(error.message);
}

/** Correct the amount and day of a posted payment. */
export async function editAaaFuelPayment(id: number, amount: number, date: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.rpc('aaa_fuel_edit_payment', { p_payment_id: id, p_amount: amount, p_date: date });
  if (error) throw new Error(error.message);
}

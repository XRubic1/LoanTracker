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
      .limit(100),
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

import type { AaaPayment, AaaPayee } from '@/types';
import { AAA_PAYEES } from '@/types';

export type AaaPayeeFilter = 'all' | AaaPayee;

export type AaaReceiptFilter = 'all' | 'received' | 'not_received' | 'awaiting';

export interface AaaPaymentFilterState {
  search: string;
  payee: AaaPayeeFilter;
  client: string;
  /** Receipt status set by AAA Fuel (only AAA Mega Fuel payments have one). */
  receipt: AaaReceiptFilter;
}

export const defaultAaaPaymentFilters: AaaPaymentFilterState = {
  search: '',
  payee: 'all',
  client: 'all',
  receipt: 'all',
};

/** Where an AAA Mega Fuel payment stands with AAA Fuel; null for payments they don't track. */
export function aaaReceiptState(p: AaaPayment): 'received' | 'not_received' | 'awaiting' | null {
  if (p.receivedAt) return 'received';
  if (p.notReceivedAt) return 'not_received';
  return p.payee === 'AAA Mega Fuel' ? 'awaiting' : null;
}

/** Unique client names from payments, sorted alphabetically. */
export function getAaaPaymentClients(payments: AaaPayment[]): string[] {
  const names = new Set(payments.map((p) => p.client.trim()).filter(Boolean));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/** Apply search, payee, and client filters to AAA payments. */
export function filterAaaPayments(
  payments: AaaPayment[],
  filters: AaaPaymentFilterState
): AaaPayment[] {
  const q = filters.search.trim().toLowerCase();
  return payments.filter((p) => {
    if (filters.payee !== 'all' && p.payee !== filters.payee) return false;
    if (filters.client !== 'all' && p.client !== filters.client) return false;
    if (filters.receipt !== 'all' && aaaReceiptState(p) !== filters.receipt) return false;
    if (!q) return true;
    return (
      p.client.toLowerCase().includes(q) ||
      p.payee.toLowerCase().includes(q) ||
      String(p.amount).includes(q) ||
      p.paymentDate.includes(q)
    );
  });
}

/** Human-readable summary of active filters for print headers. */
export function describeAaaPaymentFilters(filters: AaaPaymentFilterState): string {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push(`Search: "${filters.search.trim()}"`);
  if (filters.payee !== 'all') parts.push(`Payee: ${filters.payee}`);
  if (filters.client !== 'all') parts.push(`Client: ${filters.client}`);
  if (filters.receipt !== 'all') {
    parts.push(
      `Receipt: ${filters.receipt === 'received' ? 'Received' : filters.receipt === 'not_received' ? 'Not received' : 'Awaiting'}`
    );
  }
  return parts.length ? parts.join(' · ') : 'All payments';
}

export { AAA_PAYEES };

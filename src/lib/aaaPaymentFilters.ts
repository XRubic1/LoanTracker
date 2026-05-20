import type { AaaPayment, AaaPayee } from '@/types';
import { AAA_PAYEES } from '@/types';

export type AaaPayeeFilter = 'all' | AaaPayee;

export interface AaaPaymentFilterState {
  search: string;
  payee: AaaPayeeFilter;
  client: string;
}

export const defaultAaaPaymentFilters: AaaPaymentFilterState = {
  search: '',
  payee: 'all',
  client: 'all',
};

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
  return parts.length ? parts.join(' · ') : 'All payments';
}

export { AAA_PAYEES };

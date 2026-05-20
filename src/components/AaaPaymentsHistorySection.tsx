import { useState } from 'react';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { fmt, fmtDate } from '@/lib/utils';
import type { AaaPayment } from '@/types';
import {
  AAA_PAYEES,
  defaultAaaPaymentFilters,
  describeAaaPaymentFilters,
  filterAaaPayments,
  getAaaPaymentClients,
  type AaaPaymentFilterState,
} from '@/lib/aaaPaymentFilters';
import { printAaaPaymentsByPayee, printAaaPaymentsFiltered } from '@/lib/printAaaPayments';

interface AaaPaymentsHistorySectionProps {
  payments: AaaPayment[];
  onEdit: (id: number) => void;
  title?: string;
}

export function AaaPaymentsHistorySection({
  payments,
  onEdit,
  title = 'Payment history',
}: AaaPaymentsHistorySectionProps) {
  const [filters, setFilters] = useState<AaaPaymentFilterState>(defaultAaaPaymentFilters);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  const clientOptions = getAaaPaymentClients(payments);
  const filtered = filterAaaPayments(payments, filters);
  const filterDescription = describeAaaPaymentFilters(filters);
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);

  const updateFilter = <K extends keyof AaaPaymentFilterState>(
    key: K,
    value: AaaPaymentFilterState[K]
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <Section
      title={title}
      count={
        filtered.length === payments.length
          ? payments.length
          : `${filtered.length} / ${payments.length}`
      }
    >
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <input
              type="search"
              placeholder="Search client, payee, amount, date…"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent"
            />
          </div>
          <select
            value={filters.payee}
            onChange={(e) => updateFilter('payee', e.target.value as AaaPaymentFilterState['payee'])}
            className="bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent min-w-[140px]"
          >
            <option value="all">All payees</option>
            {AAA_PAYEES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={filters.client}
            onChange={(e) => updateFilter('client', e.target.value)}
            className="bg-surface border border-border text-text py-2 px-3 rounded-lg font-sans text-[13px] outline-none focus:border-accent min-w-[140px]"
          >
            <option value="all">All clients</option>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(filters.search || filters.payee !== 'all' || filters.client !== 'all') && (
            <button
              type="button"
              onClick={() => setFilters(defaultAaaPaymentFilters)}
              className="py-2 px-3 rounded-lg border border-border text-[12px] text-muted2 hover:text-text hover:border-accent/50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-muted2 font-mono">
            Showing {filtered.length} · Total {fmt(filteredTotal)}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPrintMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border border-border text-xs font-medium text-muted2 hover:border-accent hover:text-accent transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M7 9V4.8H17V9M7 17.6H5.8H18.2M7 14.6H17V19.2H8.28C7.84 20.48 7 19.64 7 19.2V14.6Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Print
              <svg
                className={`w-3 h-3 transition-transform ${printMenuOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path d="M5 8L10 13L15 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {printMenuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg shadow-black/20">
                <button
                  type="button"
                  onClick={() => {
                    setPrintMenuOpen(false);
                    printAaaPaymentsFiltered(filtered, filterDescription);
                  }}
                  className="block w-full px-3 py-2.5 text-left text-[12px] hover:bg-white/5 border-b border-border/50"
                >
                  <div className="font-medium text-text">Filtered list</div>
                  <div className="text-[11px] text-muted">All visible rows in one table</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintMenuOpen(false);
                    printAaaPaymentsByPayee(filtered, filterDescription);
                  }}
                  className="block w-full px-3 py-2.5 text-left text-[12px] hover:bg-white/5"
                >
                  <div className="font-medium text-text">By payee</div>
                  <div className="text-[11px] text-muted">Grouped sections with subtotals</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted text-[13px]">
          {payments.length === 0 ? 'No AAA payments recorded yet' : 'No payments match these filters'}
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Date
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Client
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Payee
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Amount
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 text-right border-b border-border w-16">
                
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.015] transition-colors group">
                <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-xs text-muted2">
                  {fmtDate(p.paymentDate)}
                </td>
                <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-medium text-text">
                  {p.client}
                </td>
                <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                  <Badge variant="closed">{p.payee}</Badge>
                </td>
                <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium text-green">
                  {fmt(p.amount)}
                </td>
                <td className="py-2.5 pr-3 border-b border-border/40 align-middle text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(p.id)}
                    className="py-1 px-2 rounded-md text-[11px] font-medium text-muted2 hover:text-accent hover:bg-accent/10 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

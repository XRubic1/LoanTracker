import { useState, useEffect } from 'react';
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);

  const clientOptions = getAaaPaymentClients(payments);
  const filtered = filterAaaPayments(payments, filters);
  const filterDescription = describeAaaPaymentFilters(filters);
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);
  const rangeEnd = filtered.length === 0 ? 0 : Math.min(pageStart + pageSize, filtered.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const updateFilter = <K extends keyof AaaPaymentFilterState>(
    key: K,
    value: AaaPaymentFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

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
              className="w-full bg-surface border border-border text-ink py-1.5 px-2.5 rounded-md font-sans text-xs outline-none focus:border-accent"
            />
          </div>
          <select
            value={filters.payee}
            onChange={(e) => updateFilter('payee', e.target.value as AaaPaymentFilterState['payee'])}
            className="select-field min-w-[140px]"
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
            className="select-field min-w-[140px]"
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
              onClick={() => {
                setFilters(defaultAaaPaymentFilters);
                setPage(1);
              }}
              className="py-2 px-3 rounded-lg border border-border text-[12px] text-muted2 hover:text-ink hover:border-accent/50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-muted2 font-mono">
            {filtered.length === 0
              ? 'No results'
              : `${rangeEnd === 0 ? 0 : pageStart + 1}–${rangeEnd} of ${filtered.length}`}{' '}
            · Total {fmt(filteredTotal)}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPrintMenuOpen((v) => !v)}
              className="dropdown-trigger"
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
              <div className="dropdown-menu w-56">
                <button
                  type="button"
                  onClick={() => {
                    setPrintMenuOpen(false);
                    printAaaPaymentsFiltered(filtered, filterDescription);
                  }}
                  className="dropdown-item"
                >
                  <div className="dropdown-item-title">Filtered list</div>
                  <div className="dropdown-item-desc">All visible rows in one table</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintMenuOpen(false);
                    printAaaPaymentsByPayee(filtered, filterDescription);
                  }}
                  className="dropdown-item"
                >
                  <div className="dropdown-item-title">By payee</div>
                  <div className="dropdown-item-desc">Grouped sections with subtotals</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-6 text-muted text-[13px]">
          {payments.length === 0 ? 'No AAA payments recorded yet' : 'No payments match these filters'}
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Date
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Client
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Payee
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Amount
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-2.5 text-right border-b border-border w-16">
                
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr key={p.id} className="row-hover transition-colors group">
                <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono text-xs text-muted2">
                  {fmtDate(p.paymentDate)}
                </td>
                <td className="py-1.5 pr-2 border-b border-divider align-middle font-medium text-ink">
                  {p.client}
                </td>
                <td className="py-1.5 pr-2 border-b border-divider align-middle">
                  <Badge variant="closed">{p.payee}</Badge>
                </td>
                <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono font-medium text-green">
                  {fmt(p.amount)}
                </td>
                <td className="py-1.5 pr-2 border-b border-divider align-middle text-right">
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

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-divider">
          <label className="flex items-center gap-2 text-[12px] text-muted2">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="select-field py-1 px-2 text-[12px]"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted2 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="py-1 px-2.5 rounded-md border border-border text-[12px] text-muted2 hover:text-ink hover:border-accent/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="py-1 px-2.5 rounded-md border border-border text-[12px] text-muted2 hover:text-ink hover:border-accent/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

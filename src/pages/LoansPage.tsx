import { useState } from 'react';
import type { Loan } from '@/types';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { fmt, fmtDate, getLoanRemaining, getNextDueDate, isDueThisWeek, isLoanPastDue, getLoanProviderDisplay } from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';
import { printOpenLoans, printOpenLoansSummary } from '@/lib/printLoans';

type LoanFilter = 'all' | 'due' | 'active' | 'hidden';

interface LoansPageProps
  extends Pick<
    UseDataResult,
    'loans' | 'markLoanPaid' | 'removeLoan'
  > {
  runWithPasswordProtection: (action: () => void) => void;
  onOpenDetail: (id: number) => void;
  onAddLoan: () => void;
}

export function LoansPage({
  loans,
  markLoanPaid: _markLoanPaid, // provided but not used in this list view
  removeLoan: _removeLoan,
  runWithPasswordProtection: _runWithPasswordProtection,
  onOpenDetail,
  onAddLoan,
}: LoansPageProps) {
  const [filter, setFilter] = useState<LoanFilter>('all');
  const [hideClosed, setHideClosed] = useState(true); // start with closed loans hidden
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  let list: Loan[] = [...loans];
  if (filter === 'due') list = list.filter((l) => !l.hidden && isDueThisWeek(l));
  if (filter === 'active') list = list.filter((l) => !l.hidden && l.paidCount < l.totalInstallments);
  if (filter === 'hidden') list = list.filter((l) => l.hidden);
  if (filter === 'all') list = list.filter((l) => !l.hidden);

  // Optional: hide fully paid loans in this list view (closed loans are shown on the Closed tab instead)
  if (hideClosed) {
    list = list.filter((l) => l.paidCount < l.totalInstallments);
  }

  return (
    <>
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">Loans</h1>
        <div className="relative flex flex-wrap gap-2 justify-start sm:justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPrintMenuOpen((v) => !v)}
              className="dropdown-trigger"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M7 9V4.8C7 4.35817 7 4.13726 7.08797 3.96449C7.16523 3.8103 7.2903 3.68523 7.44449 3.60797C7.61726 3.52 7.83817 3.52 8.28 3.52H15.72C16.1618 3.52 16.3827 3.52 16.5555 3.60797C16.7097 3.68523 16.8348 3.8103 16.912 3.96449C17 4.13726 17 4.35817 17 4.8V9M7 17.6H5.8C5.3592 17.6 5.1388 17.6 4.96447 17.512C4.80973 17.4348 4.68523 17.3103 4.60797 17.1555C4.52 17.0012 4.52 16.7808 4.52 16.34V11.66C4.52 11.2192 4.52 10.9988 4.60797 10.8245C4.68523 10.6697 4.80973 10.5452 4.96447 10.468C5.1388 10.38 5.3592 10.38 5.8 10.38H18.2C18.6408 10.38 18.8612 10.38 19.0355 10.468C19.1903 10.5452 19.3148 10.6697 19.392 10.8245C19.48 10.9988 19.48 11.2192 19.48 11.66V16.34C19.48 16.7808 19.48 17.0012 19.392 17.1555C19.3148 17.3103 19.1903 17.4348 19.0355 17.512C18.8612 17.6 18.6408 17.6 18.2 17.6H17M7 14.6H17V19.2C17 19.6408 17 19.8612 16.912 20.0355C16.8348 20.1903 16.7097 20.3148 16.5555 20.392C16.3827 20.48 16.1618 20.48 15.72 20.48H8.28C7.83817 20.48 7.61726 20.48 7.44449 20.392C7.2903 20.3148 7.16523 20.1903 7.08797 20.0355C7 19.8612 7 19.6408 7 19.2V14.6Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Print open loans</span>
              <svg
                className={`w-3 h-3 transition-transform ${
                  printMenuOpen ? 'rotate-180' : ''
                }`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M5 8L10 13L15 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {printMenuOpen && (
              <div className="dropdown-menu w-56">
                <button
                  type="button"
                  onClick={() => {
                    setPrintMenuOpen(false);
                    printOpenLoansSummary(loans);
                  }}
                  className="dropdown-item"
                >
                  <div className="dropdown-item-title">Short report (one sheet)</div>
                  <div className="dropdown-item-desc">Compact table of all open loans</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintMenuOpen(false);
                    printOpenLoans(loans);
                  }}
                  className="dropdown-item"
                >
                  <div className="dropdown-item-title">Full detailed report</div>
                  <div className="dropdown-item-desc">Per-loan summary and full schedules</div>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onAddLoan}
            className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg btn-primary text-xs font-medium transition-colors hover:opacity-90"
          >
            + Add Loan
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="filter-group">
          {(['all', 'due', 'active', 'hidden'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`filter-btn ${filter === f ? 'filter-btn-active' : ''}`}
            >
              {f === 'all'
                ? 'All'
                : f === 'due'
                  ? 'Due This Week'
                  : f === 'active'
                    ? 'Active'
                    : 'Hidden'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setHideClosed((v) => !v)}
          className={`toggle-chip ${hideClosed ? 'toggle-chip-active' : ''}`}
        >
          <span className="toggle-chip-box">{hideClosed ? '✓' : ''}</span>
          <span>Hide closed loans</span>
        </button>
      </div>

      <Section title="Loans">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border whitespace-nowrap">
                Client
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Provider
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Total
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Installment
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border min-w-[110px]">
                Progress
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Remaining
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Next Due
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Status
              </th>
              <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-6 text-muted text-[13px]">
                  No loans found
                </td>
              </tr>
            ) : (
              list.map((l) => {
                const rem = getLoanRemaining(l);
                const pct = Math.round((l.paidCount / l.totalInstallments) * 100);
                const nd = getNextDueDate(l);
                const isClosed = l.paidCount >= l.totalInstallments;
                const isDue = isDueThisWeek(l);
                const pastDue = isLoanPastDue(l);
                const status =
                  isClosed ? (
                    <Badge variant="closed">Closed</Badge>
                  ) : pastDue ? (
                    <Badge variant="overdue">Past Due</Badge>
                  ) : isDue ? (
                    <Badge variant="due">Due</Badge>
                  ) : (
                    <Badge variant="ok">Active</Badge>
                  );
                const copyRef = () => {
                  const text = l.ref || `${l.client}`;
                  navigator.clipboard.writeText(text).then(() => {}, () => {});
                };
                return (
                  <tr key={l.id} className="row-hover transition-colors">
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">
                      <div className="font-medium text-ink">{l.client}</div>
                      <div className="text-[11px] text-muted font-mono mt-0.5 flex items-center gap-1.5">
                        {l.ref}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); copyRef(); }}
                          className="p-0.5 rounded text-muted2 hover:text-accent hover:bg-accent/10"
                          title="Copy loan number"
                          aria-label="Copy"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">
                      <div className="text-[13px]">{getLoanProviderDisplay(l)}</div>
                      {l.factoringFee != null && l.factoringFee > 0 && (
                        <div className="text-[10px] text-muted2">Fee {fmt(l.factoringFee)}</div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono font-medium">
                      {fmt(l.total)}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono font-medium text-yellow">
                      {fmt(l.installment)}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle min-w-[110px]">
                      <div className="flex items-center gap-2">
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${
                              isClosed
                                ? 'progress-fill--closed'
                                : pastDue
                                  ? 'progress-fill--overdue'
                                  : isDue
                                    ? 'progress-fill--due'
                                    : 'progress-fill--default'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted font-mono whitespace-nowrap">
                          {l.paidCount}/{l.totalInstallments}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">
                      <span className={`font-mono font-medium ${isClosed ? 'text-green' : ''}`}>
                        {fmt(rem)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono text-xs text-muted2">
                      {nd ? fmtDate(nd) : '—'}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">{status}</td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(l.id)}
                        className="text-[11px] text-accent hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Section>
    </>
  );
}

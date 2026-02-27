import { useState } from 'react';
import type { Loan } from '@/types';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { fmt, fmtDate, getLoanRemaining, getNextDueDate, isDueThisWeek, getLoanProviderDisplay } from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';

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
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-semibold">Loans</h1>
        <button
          type="button"
          onClick={onAddLoan}
          className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-0 bg-accent text-white text-xs font-medium transition-colors hover:bg-[#3a7de8]"
        >
          + Add Loan
        </button>
      </div>

      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex gap-1 bg-surface p-1 rounded-[10px] w-fit">
          {(['all', 'due', 'active', 'hidden'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`py-1.5 px-4 rounded-md text-[13px] font-medium transition-colors ${
                filter === f ? 'bg-card text-text' : 'text-muted2'
              }`}
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
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            hideClosed
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border bg-surface text-muted2 hover:text-text'
          }`}
        >
          <span
            className={`w-[14px] h-[14px] rounded-[4px] border flex items-center justify-center text-[10px] ${
              hideClosed ? 'bg-accent border-accent text-white' : 'border-border'
            }`}
          >
            {hideClosed ? '✓' : ''}
          </span>
          <span>Hide closed loans</span>
        </button>
      </div>

      <Section title="Loans">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border whitespace-nowrap">
                Client
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Provider
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Total
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Installment
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border min-w-[110px]">
                Progress
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Remaining
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Next Due
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                Status
              </th>
              <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted text-[13px]">
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
                const status =
                  isClosed ? (
                    <Badge variant="closed">Closed</Badge>
                  ) : isDue ? (
                    <Badge variant="due">Due</Badge>
                  ) : (
                    <Badge variant="ok">Active</Badge>
                  );
                return (
                  <tr
                    key={l.id}
                    className="cursor-pointer hover:bg-white/[0.015] transition-colors"
                    onClick={() => onOpenDetail(l.id)}
                  >
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <div className="font-medium text-text">{l.client}</div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">{l.ref}</div>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <div className="text-[13px]">{getLoanProviderDisplay(l)}</div>
                      {l.factoringFee != null && l.factoringFee > 0 && (
                        <div className="text-[10px] text-muted2">Fee {fmt(l.factoringFee)}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium">
                      {fmt(l.total)}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium">
                      {fmt(l.installment)}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle min-w-[110px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-border rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-[width] ${
                              isClosed ? 'bg-green' : isDue ? 'bg-yellow' : 'bg-accent'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted font-mono whitespace-nowrap">
                          {l.paidCount}/{l.totalInstallments}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <span className={`font-mono font-medium ${isClosed ? 'text-green' : ''}`}>
                        {fmt(rem)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-xs text-muted2">
                      {nd ? fmtDate(nd) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">{status}</td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle" />
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

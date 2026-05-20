import { useState } from 'react';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { AaaPaymentForm } from '@/components/AaaPaymentForm';
import { AaaPaymentsHistorySection } from '@/components/AaaPaymentsHistorySection';
import { fmt, fmtDate } from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';

interface ClosedPageProps extends Pick<UseDataResult, 'loans' | 'reserves' | 'aaaPayments' | 'addAaaPayment'> {
  onOpenLoan: (id: number) => void;
  onOpenReserve: (id: number) => void;
  onEditAaaPayment: (id: number) => void;
}

type ClosedTab = 'loans' | 'reserves' | 'aaa';

export function ClosedPage({
  loans,
  reserves,
  aaaPayments,
  addAaaPayment,
  onOpenLoan,
  onOpenReserve,
  onEditAaaPayment,
}: ClosedPageProps) {
  const [tab, setTab] = useState<ClosedTab>('loans');

  const closedLoans = loans.filter((l) => l.paidCount >= l.totalInstallments && !l.hidden);
  const closedReserves = reserves.filter((r) => r.paidCount >= r.installments);

  const tabBtn = (id: ClosedTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`py-1.5 px-4 rounded-md text-[13px] font-medium transition-colors ${
        tab === id ? 'bg-card text-text' : 'text-muted2 hover:text-text'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-semibold">Closed</h1>
      </div>

      <div className="flex flex-wrap gap-1 mb-5 bg-surface p-1 rounded-[10px] w-fit">
        {tabBtn('loans', 'Loans')}
        {tabBtn('reserves', 'Reserves')}
        {tabBtn('aaa', 'AAA Payment')}
      </div>

      {tab === 'loans' && (
        <Section title="Closed loans" count={closedLoans.length}>
          {closedLoans.length === 0 ? (
            <div className="text-center py-10 text-muted text-[13px]">No closed loans yet</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Client
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Ref
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Total Paid
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Installments
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {closedLoans.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => onOpenLoan(l.id)}
                    className="hover:bg-white/[0.015] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <div className="font-medium text-text">{l.client}</div>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-[11px] text-muted">
                      {l.ref}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium text-green">
                      {fmt(l.total)}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-xs text-muted2">
                      {l.totalInstallments} payments
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <Badge variant="ok">Paid in Full</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {tab === 'reserves' && (
        <Section title="Closed reserves" count={closedReserves.length}>
          {closedReserves.length === 0 ? (
            <div className="text-center py-10 text-muted text-[13px]">No closed reserves yet</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Client
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Per Deduction
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Total
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Installments
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Last Deducted
                  </th>
                  <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {closedReserves.map((r) => {
                  const lastDeducted =
                    r.deductionDates?.length
                      ? fmtDate(r.deductionDates[r.deductionDates.length - 1])
                      : '—';
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onOpenReserve(r.id)}
                      className="hover:bg-white/[0.015] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                        <div className="font-medium text-text">{r.client}</div>
                        {r.note && (
                          <div className="text-[11px] text-muted font-mono">{r.note}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium text-accent2">
                        {fmt(r.amount / r.installments)}
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium text-green">
                        {fmt(r.amount)}
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-xs text-muted2">
                        {r.installments} deductions
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-xs text-muted2">
                        {lastDeducted}
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                        <Badge variant="ok">Fully Deducted</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {tab === 'aaa' && (
        <div className="space-y-5">
          <Section title="Record AAA payment">
            <AaaPaymentForm onSubmit={async (payload) => { await addAaaPayment(payload); }} />
          </Section>

          <AaaPaymentsHistorySection
            payments={aaaPayments}
            onEdit={onEditAaaPayment}
            title="AAA payment history"
          />
        </div>
      )}
    </>
  );
}

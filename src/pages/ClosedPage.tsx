import { useState } from 'react';
import { Section } from '@/components/Section';
import { Badge } from '@/components/Badge';
import { AaaPaymentForm } from '@/components/AaaPaymentForm';
import { AaaPaymentsHistorySection } from '@/components/AaaPaymentsHistorySection';
import { fmt, fmtDate } from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';

interface ClosedPageProps
  extends Pick<UseDataResult, 'loans' | 'reserves' | 'aaaPayments' | 'addAaaPayment' | 'clientInsurance'> {
  onOpenLoan: (id: number) => void;
  onOpenReserve: (id: number) => void;
  onEditAaaPayment: (id: number) => void;
  onDeleteAaaPayment?: (id: number) => Promise<void>;
}

type ClosedTab = 'loans' | 'reserves' | 'aaa';

export function ClosedPage({
  loans,
  reserves,
  aaaPayments,
  addAaaPayment,
  clientInsurance,
  onOpenLoan,
  onOpenReserve,
  onEditAaaPayment,
  onDeleteAaaPayment,
}: ClosedPageProps) {
  const [tab, setTab] = useState<ClosedTab>('loans');

  const closedLoans = loans.filter((l) => l.paidCount >= l.totalInstallments && !l.hidden);
  const closedReserves = reserves.filter((r) => r.paidCount >= r.installments);

  const tabBtn = (id: ClosedTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`filter-btn ${tab === id ? 'filter-btn-active' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Closed</h1>
      </div>

      <div className="filter-group mb-3">
        {tabBtn('loans', 'Loans')}
        {tabBtn('reserves', 'Reserves')}
        {tabBtn('aaa', 'AAA Payment')}
      </div>

      {tab === 'loans' && (
        <Section title="Closed loans" count={closedLoans.length}>
          {closedLoans.length === 0 ? (
            <div className="text-center py-6 text-muted text-[13px]">No closed loans yet</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Client
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Ref
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Total Paid
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Installments
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {closedLoans.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => onOpenLoan(l.id)}
                    className="row-hover transition-colors cursor-pointer"
                  >
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">
                      <div className="font-medium text-ink">{l.client}</div>
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono text-[11px] text-muted">
                      {l.ref}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono font-medium text-green">
                      {fmt(l.total)}
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono text-xs text-muted2">
                      {l.totalInstallments} payments
                    </td>
                    <td className="py-1.5 pr-2 border-b border-divider align-middle">
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
            <div className="text-center py-6 text-muted text-[13px]">No closed reserves yet</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Client
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Per Deduction
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Total
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Installments
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
                    Last Deducted
                  </th>
                  <th className="text-[10px] text-label uppercase tracking-widest py-0 pb-1.5 pr-2 text-left border-b border-border">
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
                      className="row-hover transition-colors cursor-pointer"
                    >
                      <td className="py-1.5 pr-2 border-b border-divider align-middle">
                        <div className="font-medium text-ink">{r.client}</div>
                        {r.note && (
                          <div className="text-[11px] text-muted font-mono">{r.note}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono font-medium text-reserve">
                        {fmt(r.amount / r.installments)}
                      </td>
                      <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono font-medium text-green">
                        {fmt(r.amount)}
                      </td>
                      <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono text-xs text-muted2">
                        {r.installments} deductions
                      </td>
                      <td className="py-1.5 pr-2 border-b border-divider align-middle font-mono text-xs text-muted2">
                        {lastDeducted}
                      </td>
                      <td className="py-1.5 pr-2 border-b border-divider align-middle">
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
            <AaaPaymentForm
              clientInsurance={clientInsurance}
              onSubmit={async (payload) => {
                await addAaaPayment(payload);
              }}
            />
          </Section>

          <AaaPaymentsHistorySection
            payments={aaaPayments}
            onEdit={onEditAaaPayment}
            onDelete={onDeleteAaaPayment}
            title="AAA payment history"
          />
        </div>
      )}
    </>
  );
}

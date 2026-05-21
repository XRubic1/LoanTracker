import { useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js';
Chart.register(ArcElement, Tooltip, DoughnutController);
import { Section } from '@/components/Section';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import {
  fmt,
  fmtDate,
  getLoanRemaining,
  getNextDueDate,
  getReserveNextDueDate,
  isDueThisWeek,
  isLoanPastDue,
  isReserveDueThisWeek,
  isReserveOverdue,
  isToday,
  getLoanProviderDisplay,
  getLoanBasePerInstallment,
  getLoanFeePerInstallment,
} from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';
import { insuranceNeedsVerification } from '@/lib/clientInsuranceUtils';
import { AaaPaymentForm } from '@/components/AaaPaymentForm';

/* Saturated palette that reads well on a white/light background */
const CHART_COLORS = ['#7F77DD', '#D85A30', '#D4537E', '#BA7517', '#1D9E75', '#378ADD', '#534AB7', '#888780', '#E24B4A'];

export function OverviewPage({
  loans,
  reserves,
  clientInsurance = [],
  insuranceVerification = null,
  addAaaPayment,
  onOpenCloseInstallment,
  onOpenCloseDeduction,
}: Pick<
  UseDataResult,
  'loans' | 'reserves' | 'clientInsurance' | 'insuranceVerification' | 'addAaaPayment'
> & {
  onOpenCloseInstallment: (loanId: number) => void;
  onOpenCloseDeduction: (reserveId: number) => void;
}) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const visibleLoans = loans.filter((l) => !l.hidden);
  const activeLoans = visibleLoans.filter((l) => l.paidCount < l.totalInstallments);
  const closedLoans = visibleLoans.filter((l) => l.paidCount >= l.totalInstallments);
  const dueLoans = activeLoans.filter(isDueThisWeek);
  const totalOutstanding = activeLoans.reduce((s, l) => s + getLoanRemaining(l), 0);
  const weekDueAmount = dueLoans.reduce((s, l) => s + l.installment, 0);
  const resWeek = reserves.filter(isReserveDueThisWeek);
  const resWeekTotal = resWeek.reduce((s, r) => s + r.amount / r.installments, 0);
  const upcoming = activeLoans
    .filter((l) => !isDueThisWeek(l))
    .map((l) => ({ ...l, nextDate: getNextDueDate(l) }))
    .filter((l) => l.nextDate)
    .sort((a, b) => a.nextDate!.getTime() - b.nextDate!.getTime())
    .slice(0, 6);

  /** Show warning when client insurance exists but hasn't been verified this week (Mon–Sun). */
  const showInsuranceNeedsVerification =
    clientInsurance.length > 0 && insuranceNeedsVerification(insuranceVerification);

  useEffect(() => {
    if (!chartRef.current || activeLoans.length === 0) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: activeLoans.map((l) => l.client),
        datasets: [
          {
            data: activeLoans.map((l) => getLoanRemaining(l)),
            backgroundColor: CHART_COLORS.slice(0, activeLoans.length),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => ' ' + fmt(Number(c.raw)),
            },
          },
        },
      },
    });
    return () => {
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, [activeLoans]);

  return (
    <>
      {/* Insurance verification alert — shown above the main grid */}
      {showInsuranceNeedsVerification && (
        <div className="alert-banner-warn mb-3 text-[11px] rounded-r-[3px]" role="alert">
          <svg className="h-[13px] w-[13px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            <strong className="font-medium">Insurance needs verification</strong>
            {' — not verified this week. '}
            {insuranceVerification?.last_checked_date && insuranceVerification?.checked_by && (
              <>Last: {new Date(insuranceVerification.last_checked_date).toLocaleDateString('en-US')} by {insuranceVerification.checked_by}.</>
            )}
          </span>
        </div>
      )}

      {/* Main 2-column layout: left (stats + tables) / right 240px (form + reserves) */}
      <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-3">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-3">

          {/* Stats — 4 cards */}
          <div className="grid grid-cols-4 gap-2.5 pt-3">
            <StatCard
              accent
              label="Outstanding"
              value={fmt(totalOutstanding)}
              sub={`${activeLoans.length} active loans`}
            />
            <StatCard
              label="Due this week"
              value={fmt(weekDueAmount)}
              valueClassName="text-yellow"
              sub={`${dueLoans.length} payments`}
            />
            <StatCard
              label="Reserve due"
              value={fmt(resWeekTotal)}
              valueClassName="text-reserve"
              sub={`${resWeek.length} deductions`}
            />
            <StatCard
              label="Closed"
              value={String(closedLoans.length)}
              sub="Fully repaid"
            />
          </div>

          {/* Due this week — loans */}
          <Section title="Due This Week — Loans" count={dueLoans.length} noPadding>
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Client', 'Provider', 'Installment', 'Remaining', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="text-[10px] text-label font-normal uppercase tracking-[0.05em] px-4 py-2 text-left border-b border-border"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dueLoans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted text-[11px]">
                      No loans due this week
                    </td>
                  </tr>
                ) : (
                  dueLoans.map((l) => {
                    const rem = getLoanRemaining(l);
                    const left = l.totalInstallments - l.paidCount;
                    const pastDue = isLoanPastDue(l);
                    return (
                      <tr
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenCloseInstallment(l.id)}
                        onKeyDown={(e) => e.key === 'Enter' && onOpenCloseInstallment(l.id)}
                        className="row-hover transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-[9px] border-b border-border align-middle overflow-hidden">
                          <div className="font-medium text-[11px] text-ink truncate">{l.client}</div>
                          <div className="text-[10px] text-muted">{l.ref}</div>
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle overflow-hidden">
                          <div className="text-[11px] truncate">{getLoanProviderDisplay(l)}</div>
                          {l.factoringFee != null && l.factoringFee > 0 && (
                            <div className="text-[10px] text-muted">Fee {fmt(l.factoringFee)}</div>
                          )}
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle">
                          <div className="text-[11px] font-medium text-yellow">
                            {fmt(getLoanBasePerInstallment(l))}
                          </div>
                          {l.factoringFee != null && l.factoringFee > 0 && (
                            <div className="text-[10px] text-muted">
                              +{fmt(getLoanFeePerInstallment(l))} → <span className="text-yellow">{fmt(l.installment)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle">
                          <div className="text-[11px] font-medium">{fmt(rem)}</div>
                          <div className="text-[10px] text-muted">{left} left</div>
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle">
                          {pastDue ? (
                            <Badge variant="overdue">Past due</Badge>
                          ) : (
                            <Badge variant="due">Due</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Section>

          {/* Upcoming loans + Reserves due this week — side by side */}
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <Section title="Upcoming Loans" noPadding>
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {['Client', 'Loan', 'Provider', 'Next date', 'Amount'].map((h) => (
                      <th
                        key={h}
                        className="text-[10px] text-label font-normal uppercase tracking-[0.05em] px-4 py-2 text-left border-b border-border"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted text-[11px]">—</td>
                    </tr>
                  ) : (
                    upcoming.map((l) => (
                      <tr key={l.id} className="row-hover transition-colors">
                        <td className="px-4 py-[9px] border-b border-border align-middle overflow-hidden">
                          <div className="font-medium text-[11px] text-ink truncate">{l.client}</div>
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle">
                          <div className="text-[10px] text-muted">
                            {l.ref} · {l.totalInstallments - l.paidCount} left
                          </div>
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle overflow-hidden">
                          <div className="text-[11px] truncate">{getLoanProviderDisplay(l)}</div>
                          {l.factoringFee != null && l.factoringFee > 0 && (
                            <div className="text-[10px] text-muted">Fee {fmt(l.factoringFee)}</div>
                          )}
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle text-[11px] text-muted">
                          {l.nextDate ? fmtDate(l.nextDate) : '—'}
                        </td>
                        <td className="px-4 py-[9px] border-b border-border align-middle text-[11px] font-medium text-yellow">
                          {l.factoringFee != null && l.factoringFee > 0 ? (
                            <>
                              <div>{fmt(getLoanBasePerInstallment(l))}</div>
                              <div className="text-[10px] text-muted font-normal">
                                +{fmt(getLoanFeePerInstallment(l))} = {fmt(l.installment)}
                              </div>
                            </>
                          ) : (
                            fmt(l.installment)
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Section>

            <Section title="Reserves Due This Week" count={resWeek.length} noPadding>
              {resWeek.length === 0 ? (
                <div className="text-center py-6 text-muted text-[11px]">No reserve deductions this week</div>
              ) : (
                resWeek.map((r) => {
                  const perInst = r.amount / r.installments;
                  const nextDue = getReserveNextDueDate(r);
                  const isDueToday = nextDue && isToday(nextDue);
                  const isOverdue = isReserveOverdue(r);
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenCloseDeduction(r.id)}
                      onKeyDown={(e) => e.key === 'Enter' && onOpenCloseDeduction(r.id)}
                      className="flex items-center gap-2 px-4 py-[9px] border-b border-border last:border-b-0 row-hover transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <span className="text-[11px] font-medium text-ink">{r.client}</span>
                        <span className="ml-1 text-[10px] text-muted">
                          {r.paidCount + 1}/{r.installments}
                        </span>
                        {r.note && (
                          <div className="text-[10px] text-muted truncate">{r.note}</div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-reserve flex-shrink-0">{fmt(perInst)}</span>
                      <span className="text-[10px] text-muted flex-shrink-0">
                        {nextDue ? fmtDate(nextDue) : '—'}
                      </span>
                      {isDueToday ? (
                        <Badge variant="ok">Today</Badge>
                      ) : isOverdue ? (
                        <Badge variant="overdue">Overdue</Badge>
                      ) : null}
                    </div>
                  );
                })
              )}
            </Section>
          </div>
        </div>

        {/* ── Right column (240px) ── */}
        <div className="flex flex-col gap-3 pt-3">

          {/* AAA Payment form */}
          <Section title="Record AAA Payment" noPadding>
            <div className="px-4 py-[14px]">
              <AaaPaymentForm
                compact
                clientInsurance={clientInsurance}
                onSubmit={async (payload) => {
                  await addAaaPayment(payload);
                }}
              />
            </div>
          </Section>

          {/* Portfolio — donut + legend */}
          <Section title="Portfolio" count={`${activeLoans.length} clients`} noPadding>
            <div className="flex flex-col items-center gap-3 px-4 py-[14px]">
              <div className="relative w-[72px] h-[72px] flex-shrink-0">
                <canvas ref={chartRef} width={72} height={72} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[16px] font-medium text-ink leading-none">{activeLoans.length}</span>
                  <span className="text-[9px] text-muted uppercase tracking-[0.05em]">clients</span>
                </div>
              </div>
              <div className="w-full flex flex-col gap-y-[3px] min-w-0">
                {activeLoans.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-[5px] min-w-0">
                    <div
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="flex-1 text-[10px] text-muted truncate">{l.client}</span>
                    <span className="text-[10px] font-medium text-ink flex-shrink-0">
                      ${Math.round(getLoanRemaining(l) / 1000)}k
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

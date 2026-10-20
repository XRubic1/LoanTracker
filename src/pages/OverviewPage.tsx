import { useEffect, useRef } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js';
Chart.register(ArcElement, Tooltip, DoughnutController);
import { Section } from '@/components/Section';
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
  getLoanOpenInstallmentDue,
  getLoanOpenInstallmentRemaining,
  getLoanBasePerInstallment,
  getLoanFeePerInstallment,
} from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';
import {
  insuranceNeedsVerification,
  isInsuranceCancellationStatus,
  getDaysUntilCancellation,
  getInsuranceCancelDateForDisplay,
} from '@/lib/clientInsuranceUtils';
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

  /** Clients with a pending/scheduled insurance cancellation; clients with active loans first, then soonest date. */
  const activeLoanClients = new Set(activeLoans.map((l) => l.client.trim().toLowerCase()));
  const cancellations = clientInsurance
    .filter((c) => isInsuranceCancellationStatus(c.status))
    .map((c) => ({
      c,
      days: getDaysUntilCancellation(c),
      date: getInsuranceCancelDateForDisplay(c),
      hasLoan: activeLoanClients.has(c.client.trim().toLowerCase()),
    }))
    .sort(
      (a, b) =>
        Number(b.hasLoan) - Number(a.hasLoan) ||
        Number((a.days ?? 0) < 0) - Number((b.days ?? 0) < 0) ||
        (a.days ?? Infinity) - (b.days ?? Infinity)
    );

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

  const urgentCount = cancellations.filter((x) => x.days != null && x.days >= 0 && x.days <= 7).length;
  const loanRiskCount = cancellations.filter((x) => x.hasLoan).length;
  const pastDueCount = dueLoans.filter(isLoanPastDue).length;

  return (
    <>
      {/* Insurance verification alert */}
      {showInsuranceNeedsVerification && (
        <div className="alert-banner-warn mb-1 text-[11px] rounded-r-[3px]" role="alert">
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

      <div className="flex flex-col gap-4 pt-3">
        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiTile label="Outstanding" value={fmt(totalOutstanding)} sub={`${activeLoans.length} active loans · ${closedLoans.length} closed`} tone="accent" />
          <KpiTile
            label="Due this week"
            value={fmt(weekDueAmount)}
            sub={`${dueLoans.length} payments${pastDueCount ? ` · ${pastDueCount} past due` : ''}`}
            tone="yellow"
          />
          <KpiTile label="Reserve due" value={fmt(resWeekTotal)} sub={`${resWeek.length} deductions`} tone="reserve" />
          <KpiTile
            label="Insurance alerts"
            value={String(cancellations.length)}
            sub={
              cancellations.length === 0
                ? 'No pending cancellations'
                : `${urgentCount} within 7 days · ${loanRiskCount} with active loans`
            }
            tone={urgentCount > 0 ? 'red' : 'muted'}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
          {/* ── Main column ── */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Due this week — loans */}
            <Section title="Due This Week — Loans" count={dueLoans.length} noPadding>
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
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
                      <td colSpan={5} className="text-center py-8 text-muted text-[12px]">
                        No loans due this week
                      </td>
                    </tr>
                  ) : (
                    dueLoans.map((l) => {
                      const rem = getLoanRemaining(l);
                      const left = l.totalInstallments - l.paidCount;
                      const pastDue = isLoanPastDue(l);
                      const openDue = getLoanOpenInstallmentDue(l);
                      const openLeft = getLoanOpenInstallmentRemaining(l);
                      const partialPaid = Number(l.partialPaidAmount ?? 0) || 0;
                      /** e.g. "Adams L596 $21,648.56 ( AAA Lease )" — base installment, without the fee. */
                      const copyLine = `${l.client} ${l.ref} ${fmt(getLoanBasePerInstallment(l))} ( ${getLoanProviderDisplay(l)} )`;
                      return (
                        <tr
                          key={l.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenCloseInstallment(l.id)}
                          onKeyDown={(e) => e.key === 'Enter' && onOpenCloseInstallment(l.id)}
                          className="row-hover transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-[11px] border-b border-border align-middle overflow-hidden">
                            <div className="font-medium text-[12px] text-ink truncate">{l.client}</div>
                            <div className="flex items-center gap-1 text-[10px] text-muted">
                              {l.ref}
                              <CopyButton text={copyLine} label="Copy loan line" />
                            </div>
                          </td>
                          <td className="px-4 py-[11px] border-b border-border align-middle overflow-hidden">
                            <div className="text-[11px] truncate">{getLoanProviderDisplay(l)}</div>
                            {l.factoringFee != null && l.factoringFee > 0 && (
                              <div className="text-[10px] text-muted">Fee {fmt(l.factoringFee)}</div>
                            )}
                          </td>
                          <td className="px-4 py-[11px] border-b border-border align-middle">
                            {partialPaid > 0 ? (
                              <>
                                <div className="text-[13px] font-medium text-yellow">{fmt(openLeft)} left</div>
                                <div className="text-[10px] text-green">
                                  {fmt(partialPaid)} paid of {fmt(openDue)}
                                </div>
                                <div className="mt-1 h-[3px] rounded-full bg-border overflow-hidden">
                                  <div
                                    className="h-full bg-green"
                                    style={{ width: `${Math.min(100, (partialPaid / openDue) * 100)}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-[13px] font-medium text-yellow">{fmt(openDue)}</div>
                                {l.factoringFee != null && l.factoringFee > 0 && (
                                  <div className="text-[10px] text-muted">
                                    {fmt(getLoanBasePerInstallment(l))} + {fmt(getLoanFeePerInstallment(l))} fee
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-[11px] border-b border-border align-middle">
                            <div className="text-[12px] font-medium">{fmt(rem)}</div>
                            <div className="text-[10px] text-muted">{left} left</div>
                          </td>
                          <td className="px-4 py-[11px] border-b border-border align-middle">
                            <div className="flex flex-col items-start gap-1">
                              {pastDue ? <Badge variant="overdue">Past due</Badge> : <Badge variant="due">Due</Badge>}
                              {partialPaid > 0 && <Badge variant="ok">Partial</Badge>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Section>

            {/* Upcoming loans + Reserves due this week */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
              <Section title="Upcoming Loans" count={upcoming.length} noPadding>
                {upcoming.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[12px]">No upcoming loans</div>
                ) : (
                  upcoming.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 px-4 py-[10px] border-b border-border last:border-b-0 row-hover transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-ink truncate">{l.client}</div>
                        <div className="text-[10px] text-muted truncate">
                          {l.ref} · {getLoanProviderDisplay(l)} · {l.totalInstallments - l.paidCount} left
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[12px] font-medium text-yellow">{fmt(l.installment)}</div>
                        <div className="text-[10px] text-muted">{l.nextDate ? fmtDate(l.nextDate) : '—'}</div>
                      </div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Reserves Due This Week" count={resWeek.length} noPadding>
                {resWeek.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[12px]">No reserve deductions this week</div>
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
                        className="flex items-center gap-3 px-4 py-[10px] border-b border-border last:border-b-0 row-hover transition-colors cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-ink truncate">
                            {r.client}
                            <span className="ml-1 text-[10px] text-muted font-normal">
                              {r.paidCount + 1}/{r.installments}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            {nextDue ? fmtDate(nextDue) : '—'}
                            {r.note ? ` · ${r.note}` : ''}
                          </div>
                        </div>
                        {isDueToday ? <Badge variant="ok">Today</Badge> : isOverdue ? <Badge variant="overdue">Overdue</Badge> : null}
                        <span className="text-[12px] font-medium text-reserve flex-shrink-0">{fmt(perInst)}</span>
                      </div>
                    );
                  })
                )}
              </Section>
            </div>
          </div>

          {/* ── Side column ── */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Insurance cancellations */}
            <Section title="Insurance Cancellations" count={cancellations.length} noPadding>
              {cancellations.length === 0 ? (
                <div className="text-center py-8 text-muted text-[12px]">No pending insurance cancellations</div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto">
                  {cancellations.map(({ c, days, date, hasLoan }) => {
                    const passed = days != null && days < 0;
                    const soon = days != null && days >= 0 && days <= 7;
                    const bar = passed ? 'bg-label' : soon ? 'bg-red' : 'bg-accent';
                    return (
                      <div
                        key={c.id}
                        className="flex items-stretch gap-3 pr-4 border-b border-border last:border-b-0"
                      >
                        <div className={`w-[3px] flex-shrink-0 ${bar}`} />
                        <div className="flex-1 min-w-0 py-[10px]">
                          <div className="text-[12px] font-medium text-ink truncate">{c.client}</div>
                          <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-muted">
                            {c.mc ? (
                              <span className="inline-flex items-center gap-1">
                                MC {c.mc}
                                <CopyButton text={c.mc} label="Copy MC" />
                              </span>
                            ) : null}
                            {c.dot ? (
                              <span className="inline-flex items-center gap-1">
                                DOT {c.dot}
                                <CopyButton text={c.dot} label="Copy DOT" />
                              </span>
                            ) : null}
                          </div>
                          {hasLoan && (
                            <div className="mt-1"><Badge variant="due">Active loan</Badge></div>
                          )}
                        </div>
                        <div className="flex flex-col items-end justify-center gap-1 flex-shrink-0">
                          {days != null &&
                            (passed ? (
                              <Badge variant="closed">{Math.abs(days)}d ago</Badge>
                            ) : soon ? (
                              <Badge variant="overdue">{days === 0 ? 'Today' : `in ${days}d`}</Badge>
                            ) : (
                              <Badge variant="due">in {days}d</Badge>
                            ))}
                          <span className="text-[10px] text-muted">
                            {date ? fmtDate(new Date(date + 'T00:00:00')) : 'No date'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

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
              <div className="flex items-center gap-4 px-4 py-[14px]">
                <div className="relative w-[84px] h-[84px] flex-shrink-0">
                  <canvas ref={chartRef} width={84} height={84} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[16px] font-medium text-ink leading-none">{activeLoans.length}</span>
                    <span className="text-[9px] text-muted uppercase tracking-[0.05em]">clients</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-y-[4px] min-w-0 max-h-[120px] overflow-y-auto">
                  {activeLoans.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-[6px] min-w-0">
                      <div
                        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="flex-1 text-[11px] text-muted truncate">{l.client}</span>
                      <span className="text-[11px] font-medium text-ink flex-shrink-0">
                        ${Math.round(getLoanRemaining(l) / 1000)}k
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}

const KPI_TONES = {
  accent: { bar: 'bg-accent', text: 'text-ink' },
  yellow: { bar: 'bg-yellow', text: 'text-yellow' },
  reserve: { bar: 'bg-reserve', text: 'text-reserve' },
  red: { bar: 'bg-red', text: 'text-red' },
  muted: { bar: 'bg-label', text: 'text-ink' },
} as const;

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof KPI_TONES;
}) {
  const t = KPI_TONES[tone];
  return (
    <div className="panel-surface relative overflow-hidden px-4 py-4 pl-5">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${t.bar}`} />
      <div className="text-[10px] text-label uppercase tracking-[0.05em] mb-2">{label}</div>
      <div className={`text-[24px] font-medium leading-none ${t.text}`}>{value}</div>
      <div className="text-[11px] text-muted mt-2">{sub}</div>
    </div>
  );
}

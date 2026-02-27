import { useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js';
Chart.register(ArcElement, Tooltip, DoughnutController);
import { Section } from '@/components/Section';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import {
  fmt,
  fmtDate,
  getWeekRange,
  getLoanRemaining,
  getNextDueDate,
  getReserveNextDueDate,
  isDueThisWeek,
  isReserveDueThisWeek,
  isToday,
  getLoanProviderDisplay,
  getLoanBasePerInstallment,
  getLoanFeePerInstallment,
} from '@/lib/utils';
import type { UseDataResult } from '@/hooks/useData';

const CHART_COLORS = ['#4f8ef7', '#7c5cfc', '#2ecc8f', '#f75f5f', '#f7c34f', '#f77f4f', '#4fc3f7'];

export function OverviewPage({
  loans,
  reserves,
  onOpenCloseInstallment,
  onOpenCloseDeduction,
}: Pick<UseDataResult, 'loans' | 'reserves'> & {
  onOpenCloseInstallment: (loanId: number) => void;
  onOpenCloseDeduction: (reserveId: number) => void;
}) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const activeLoans = loans.filter((l) => l.paidCount < l.totalInstallments);
  const closedLoans = loans.filter((l) => l.paidCount >= l.totalInstallments);
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
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-semibold">Overview</h1>
        <span className="bg-card border border-border py-1.5 px-3.5 rounded-full text-xs text-muted2 font-mono">
          {getWeekRange()}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard
          accent
          label="Total Outstanding"
          value={fmt(totalOutstanding)}
          sub={`${activeLoans.length} active loans`}
        />
        <StatCard
          label="Due This Week"
          value={fmt(weekDueAmount)}
          valueClassName="text-yellow"
          sub={`${dueLoans.length} payments`}
        />
        <StatCard
          label="Reserve Due"
          value={fmt(resWeekTotal)}
          valueClassName="text-accent2"
          sub={`${resWeek.length} deductions`}
        />
        <StatCard
          label="Closed Loans"
          value={String(closedLoans.length)}
          valueClassName="text-green"
          sub="fully repaid"
        />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <Section title="Due This Week — Loans" count={dueLoans.length}>
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
                  Installment
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Remaining
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {dueLoans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted text-[13px]">
                    No loans due this week
                  </td>
                </tr>
              ) : (
                dueLoans.map((l) => {
                  const rem = getLoanRemaining(l);
                  const left = l.totalInstallments - l.paidCount;
                  return (
                    <tr
                      key={l.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenCloseInstallment(l.id)}
                      onKeyDown={(e) => e.key === 'Enter' && onOpenCloseInstallment(l.id)}
                      className="hover:bg-white/[0.015] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle text-[13px]">
                        <div className="font-medium text-text">{l.client}</div>
                        <div className="text-[11px] text-muted font-mono mt-0.5">{l.ref}</div>
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle text-[12px]">
                        <span>{getLoanProviderDisplay(l)}</span>
                        {l.factoringFee != null && l.factoringFee > 0 && (
                          <div className="text-[10px] text-muted2">Fee {fmt(l.factoringFee)}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                        <div className="font-mono font-medium text-yellow">
                          {l.factoringFee != null && l.factoringFee > 0 ? (
                            <>
                              <div>{fmt(getLoanBasePerInstallment(l))}</div>
                              <div className="text-[11px] text-muted2 font-normal">
                                +{fmt(getLoanFeePerInstallment(l))} = {fmt(l.installment)}
                              </div>
                            </>
                          ) : (
                            fmt(l.installment)
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                        <span className="font-mono font-medium">{fmt(rem)}</span>
                        <div className="text-[10px] text-muted mt-0.5">{left} left</div>
                      </td>
                      <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                        <Badge variant="due">Due</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Section>

        <Section title="Reserves Due This Week" count={resWeek.length}>
          <div className="max-h-[320px] overflow-y-auto scrollable">
            {resWeek.length === 0 ? (
              <div className="text-center py-10 text-muted text-[13px]">
                No reserve deductions this week
              </div>
            ) : (
              resWeek.map((r) => {
                const perInst = r.amount / r.installments;
                const nextDue = getReserveNextDueDate(r);
                const isDueToday = nextDue && isToday(nextDue);
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenCloseDeduction(r.id)}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenCloseDeduction(r.id)}
                    className="flex items-center justify-between py-2.5 px-3.5 bg-surface rounded-[10px] text-[13px] hover:bg-white/[0.02] mb-2 last:mb-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div>
                        <div className="font-medium text-[13px]">
                          {r.client}{' '}
                          <span className="text-[10px] text-muted font-mono">
                            {r.paidCount + 1}/{r.installments}
                          </span>
                        </div>
                        {r.note && <div className="text-[11px] text-muted font-mono">{r.note}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-medium text-accent2">{fmt(perInst)}</span>
                      <span
                        className={`font-mono text-[11px] ${isDueToday ? 'text-yellow' : 'text-muted2'}`}
                      >
                        {nextDue ? fmtDate(nextDue) : '—'}
                      </span>
                      {isDueToday ? (
                        <Badge variant="due">Today</Badge>
                      ) : (
                        <Badge variant="overdue">Overdue</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-5 mb-7">
        <Section title="Upcoming Loans">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Client
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Provider
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Next Date
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-0 pb-2.5 pr-3 text-left border-b border-border">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {upcoming.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-muted text-[13px]">
                    —
                  </td>
                </tr>
              ) : (
                upcoming.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle">
                      <div className="font-medium text-text">{l.client}</div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        {l.ref}
                        <span className="ml-1.5 text-muted2">· {l.totalInstallments - l.paidCount} left</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle text-[12px]">
                      <span>{getLoanProviderDisplay(l)}</span>
                      {l.factoringFee != null && l.factoringFee > 0 && (
                        <div className="text-[10px] text-muted2">Fee {fmt(l.factoringFee)}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono text-[11px] text-muted2">
                      {l.nextDate ? fmtDate(l.nextDate) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 border-b border-border/40 align-middle font-mono font-medium">
                      {l.factoringFee != null && l.factoringFee > 0 ? (
                        <>
                          <div>{fmt(getLoanBasePerInstallment(l))}</div>
                          <div className="text-[10px] text-muted2 font-normal">
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

        <Section title="Portfolio">
          <div className="relative w-40 h-40 mx-auto">
            <canvas ref={chartRef} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[22px] font-semibold font-mono">{activeLoans.length}</span>
              <span className="text-[10px] text-muted uppercase tracking-wider">clients</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {activeLoans.map((l, i) => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span>{l.client}</span>
                </div>
                <span className="font-mono text-[11px] text-muted2">{fmt(getLoanRemaining(l))}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

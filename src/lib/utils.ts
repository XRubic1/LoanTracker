import type { Loan, Reserve } from '@/types';

const today = new Date();
const startOfWeek = new Date(today);
startOfWeek.setDate(today.getDate() - today.getDay() + 1);
const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);

export function fmt(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function isThisWeek(d: string | Date): boolean {
  const dt = new Date(d);
  return dt >= startOfWeek && dt <= endOfWeek;
}

export function isToday(d: string | Date): boolean {
  const dt = new Date(d);
  return dt.toDateString() === new Date().toDateString();
}

export function getWeekRange(): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return startOfWeek.toLocaleDateString('en-GB', opts) + ' – ' + endOfWeek.toLocaleDateString('en-GB', opts);
}

export function getReserveNextDueDate(r: Reserve): Date | null {
  if (r.paidCount >= r.installments) return null;
  const start = new Date(r.date);
  const freq = r.freqDays ?? 7;
  const d = new Date(start);
  d.setDate(d.getDate() + r.paidCount * freq);
  return d;
}

export function isReserveDueNow(r: Reserve): boolean {
  if (r.paidCount >= r.installments) return false;
  const nextDue = getReserveNextDueDate(r);
  if (!nextDue) return false;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  nextDue.setHours(0, 0, 0, 0);
  const lastDeducted = r.deductionDates?.[r.deductionDates.length - 1];
  if (lastDeducted && isToday(lastDeducted)) return false;
  return nextDue <= todayMidnight;
}

export function isReserveDueThisWeek(r: Reserve): boolean {
  if (r.paidCount >= r.installments) return false;
  const nextDue = getReserveNextDueDate(r);
  if (!nextDue) return false;
  const lastDeducted = r.deductionDates?.[r.deductionDates.length - 1];
  if (lastDeducted && isToday(lastDeducted)) return false;
  return isThisWeek(nextDue) || nextDue <= new Date();
}

export function getNextDueDate(loan: Loan): Date | null {
  if (loan.paidCount >= loan.totalInstallments) return null;
  const start = new Date(loan.startDate);
  const d = new Date(start);
  d.setDate(d.getDate() + loan.paidCount * loan.freqDays);
  return d;
}

export function getLoanRemaining(loan: Loan): number {
  return Math.max(0, loan.total - loan.paidCount * loan.installment);
}

export function isDueThisWeek(loan: Loan): boolean {
  if (loan.paidCount >= loan.totalInstallments) return false;
  const nd = getNextDueDate(loan);
  return nd !== null && isThisWeek(nd);
}

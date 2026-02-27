import type { Loan, Reserve } from '@/types';

// --- Formatting ---

export function fmt(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Display label for loan provider (TruFunding or custom name when Other). */
export function getLoanProviderDisplay(loan: Loan): string {
  if (loan.providerType === 'Other' && loan.providerName?.trim()) return loan.providerName.trim();
  return 'TruFunding';
}

/** Effective total = total + factoringFee (for display). */
export function getLoanEffectiveTotal(loan: Loan): number {
  return loan.total + (loan.factoringFee ?? 0);
}

/** Base amount per installment (before factoring fee). */
export function getLoanBasePerInstallment(loan: Loan): number {
  const n = loan.totalInstallments || 1;
  return loan.total / n;
}

/** Factoring fee per installment. */
export function getLoanFeePerInstallment(loan: Loan): number {
  const n = loan.totalInstallments || 1;
  return (loan.factoringFee ?? 0) / n;
}

// --- Date-only (YYYY-MM-DD) to avoid timezone shifts when comparing due dates to week bounds ---

/** Today as YYYY-MM-DD in local date. */
function todayDateOnly(): string {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD and add N days in calendar space; return YYYY-MM-DD. */
function addDaysDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const y2 = date.getFullYear(), m2 = date.getMonth(), d2 = date.getDate();
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}

/** Current week (Mon–Sun containing today) as date-only strings. */
function getWeekBoundsDateOnly(): { start: string; end: string } {
  const t = new Date();
  const daysToMonday = (t.getDay() + 6) % 7;
  const start = new Date(t);
  start.setDate(t.getDate() - daysToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: toStr(start), end: toStr(end) };
}

// --- Current week (computed from today so it's never stale) ---

/** Week that contains today: Monday 00:00:00 through Sunday 23:59:59. (On Sunday we use the week Mon–Sun that includes that Sunday, not next week.) */
export function getWeekBounds(): { startOfWeek: Date; endOfWeek: Date } {
  const now = new Date();
  const startOfWeek = new Date(now);
  const daysToMonday = (now.getDay() + 6) % 7;
  startOfWeek.setDate(now.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { startOfWeek, endOfWeek };
}

export function isThisWeek(d: string | Date): boolean {
  const dt = new Date(d);
  const { startOfWeek, endOfWeek } = getWeekBounds();
  return dt >= startOfWeek && dt <= endOfWeek;
}

export function isToday(d: string | Date): boolean {
  const dt = new Date(d);
  return dt.toDateString() === new Date().toDateString();
}

export function getWeekRange(): string {
  const { startOfWeek, endOfWeek } = getWeekBounds();
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return startOfWeek.toLocaleDateString('en-GB', opts) + ' – ' + endOfWeek.toLocaleDateString('en-GB', opts);
}

// --- Reserve: next due date and due-this-week (original logic: next due in week OR overdue) ---

/** Next due as Date for display. Use getReserveNextDueDateOnly for comparisons. */
export function getReserveNextDueDate(r: Reserve): Date | null {
  const str = getReserveNextDueDateOnly(r);
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
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

/** Due this week = next due (as calendar date) is within the current week only. */
export function isReserveDueThisWeek(r: Reserve): boolean {
  if (r.paidCount >= r.installments) return false;
  const dueStr = getReserveNextDueDateOnly(r);
  if (!dueStr) return false;
  const lastDeducted = r.deductionDates?.[r.deductionDates.length - 1];
  if (lastDeducted && lastDeducted === todayDateOnly()) return false;
  const { start, end } = getWeekBoundsDateOnly();
  return dueStr >= start && dueStr <= end;
}

/** Next due as YYYY-MM-DD (date-only, no timezone shift). */
function getReserveNextDueDateOnly(r: Reserve): string | null {
  if (r.paidCount >= r.installments) return null;
  const freq = r.freqDays ?? 7;
  const dates = r.deductionDates ?? [];
  if (dates.length > 0) return addDaysDateOnly(dates[dates.length - 1], freq);
  return addDaysDateOnly(r.date, r.paidCount * freq);
}

// --- Loan: next due date and due-this-week (each installment has a due date; due this week = that date is before or in current week) ---

/** Next due = last payment date + freq when payment_dates exist (backdating), else start + paidCount * freq. Returns Date for display. */
export function getNextDueDate(loan: Loan): Date | null {
  const str = getNextDueDateOnly(loan);
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Next due as YYYY-MM-DD (date-only, no timezone shift). */
function getNextDueDateOnly(loan: Loan): string | null {
  if (loan.paidCount >= loan.totalInstallments) return null;
  const freq = loan.freqDays ?? 7;
  const dates = loan.paymentDates ?? [];
  if (dates.length > 0) return addDaysDateOnly(dates[dates.length - 1], freq);
  return addDaysDateOnly(loan.startDate, loan.paidCount * freq);
}

export function getLoanRemaining(loan: Loan): number {
  return Math.max(0, loan.total - loan.paidCount * loan.installment);
}

/** Due this week = next due (as calendar date) is within the current week only. */
export function isDueThisWeek(loan: Loan): boolean {
  if (loan.paidCount >= loan.totalInstallments) return false;
  const dueStr = getNextDueDateOnly(loan);
  if (!dueStr) return false;
  const { start, end } = getWeekBoundsDateOnly();
  return dueStr >= start && dueStr <= end;
}

/** Overdue = loan that has at least one scheduled installment whose due date is before today and not yet paid. */
export function isLoanOverdue(loan: Loan): boolean {
  return getLoanOverdueCount(loan) > 0;
}

/** Number of installments that are overdue (due date already passed). */
export function getLoanOverdueCount(loan: Loan): number {
  if (loan.paidCount >= loan.totalInstallments) return 0;
  const freq = loan.freqDays ?? 7;
  const todayStr = todayDateOnly();

  // Compute how many installments should have been due by today based solely on the
  // original schedule (start date + N * freq), independent of payment dates.
  const [sy, sm, sd] = loan.startDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);

  const diffMs = today.getTime() - start.getTime();
  if (diffMs < 0) return 0; // loan hasn't started yet

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let installmentsDueByToday = Math.floor(days / freq) + 1; // first installment at start date
  installmentsDueByToday = Math.min(installmentsDueByToday, loan.totalInstallments);

  const rawOverdue = installmentsDueByToday - loan.paidCount;
  const maxRemaining = loan.totalInstallments - loan.paidCount;
  return Math.max(0, Math.min(rawOverdue, maxRemaining));
}


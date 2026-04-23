import type { ClientInsurance, InsuranceVerification } from '@/types';

/**
 * Returns the Monday 00:00 of the week containing the given date (week = Monday–Sunday).
 * Sunday is considered the last day of the previous week.
 */
function getMondayOfWeek(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const day = m.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  m.setDate(m.getDate() - daysToMonday);
  return m;
}

/** True if insurance verification is missing or not in the current week (Mon–Sun). Show Overview warning every new week until verified. */
export function insuranceNeedsVerification(verification: InsuranceVerification | null): boolean {
  if (!verification?.last_checked_date) return true;
  const checked = new Date(verification.last_checked_date);
  if (isNaN(checked.getTime())) return true;
  const thisWeekMonday = getMondayOfWeek(new Date());
  const checkedWeekMonday = getMondayOfWeek(checked);
  return thisWeekMonday.getTime() !== checkedWeekMonday.getTime();
}

/**
 * Whether this client insurance record should be shown as a warning (cancellation, inactive, or expired).
 */
export function isClientInsuranceWarning(c: ClientInsurance): boolean {
  const s = (c.status ?? '').trim().toLowerCase();
  if (s === 'ok') return false;
  if (s === 'inactive' || s === 'out') return true;
  if (s.includes('cancellation') || s.includes('cancelled') || s.includes('canceled')) return true;
  if (s.includes('insurance cancelled')) return true;
  // Date string (e.g. 05/26/2026) or expiration_date in the past
  if (c.expiration_date) {
    const exp = new Date(c.expiration_date);
    if (!isNaN(exp.getTime()) && exp < new Date()) return true; // expired
  }
  return false;
}

/** True if status is OUT (for red styling). */
export function isClientInsuranceOut(c: ClientInsurance): boolean {
  return (c.status ?? '').trim().toLowerCase() === 'out';
}

/** True if status is Inactive or OUT (for hide-inactive filter). */
export function isClientInsuranceInactiveOrOut(c: ClientInsurance): boolean {
  const s = (c.status ?? '').trim().toLowerCase();
  return s === 'inactive' || s === 'out';
}

/** True if status is cancellation AND has a date (for Overview warning + popup). */
export function isClientInsuranceCancellationWithDate(c: ClientInsurance): boolean {
  const s = (c.status ?? '').trim().toLowerCase();
  if (!s.startsWith('cancellation') && !s.includes('cancellation')) return false;
  return !!(c.expiration_date && c.expiration_date.trim());
}

/**
 * Returns whole days until cancellation date.
 * - 0 means today
 * - positive means future date
 * - negative means already passed
 */
export function getDaysUntilCancellation(c: ClientInsurance): number | null {
  if (!isClientInsuranceCancellationWithDate(c) || !c.expiration_date) return null;
  const target = new Date(c.expiration_date);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
}

/** True when cancellation date is approaching within the next N days (default 7). */
export function isClientInsuranceCancellationSoon(c: ClientInsurance, withinDays = 7): boolean {
  const daysUntil = getDaysUntilCancellation(c);
  return daysUntil != null && daysUntil >= 0 && daysUntil <= withinDays;
}

/**
 * Short label for status display (OK, Inactive, Cancellation with date if set).
 */
export function getClientInsuranceStatusLabel(c: ClientInsurance): string {
  const s = (c.status ?? '').trim();
  if (!s) return '—';
  if (s.toLowerCase() === 'ok') return 'OK';
  if (s.toLowerCase() === 'inactive') return 'Inactive';
  if (s.toLowerCase() === 'out') return 'OUT';
  if (s.toLowerCase().startsWith('cancellation') || s.toLowerCase().includes('cancellation')) {
    if (c.expiration_date) {
      const d = new Date(c.expiration_date);
      if (!isNaN(d.getTime())) {
        return `Cancellation ${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`;
      }
    }
    return 'Cancellation';
  }
  return s;
}

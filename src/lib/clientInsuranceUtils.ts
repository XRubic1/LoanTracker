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

/** Parse a date string to local YYYY-MM-DD for day-diff math. */
function parseDateToDateOnly(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Best-effort cancellation date from expiration_date, last_cancellation_date, or status text.
 * Used when the record is (or should be treated as) a cancellation.
 */
export function resolveInsuranceCancellationDate(c: ClientInsurance): string | null {
  if (c.expiration_date?.trim()) {
    const parsed = parseDateToDateOnly(c.expiration_date);
    if (parsed) return parsed;
  }
  if (c.last_cancellation_date?.trim()) {
    const parsed = parseDateToDateOnly(c.last_cancellation_date);
    if (parsed) return parsed;
  }
  const status = (c.status ?? '').trim();
  const lower = status.toLowerCase();
  if (
    lower.includes('cancellation') ||
    lower.includes('cancelled') ||
    lower.includes('canceled')
  ) {
    const tail = status.replace(/^cancellation\s*/i, '').trim();
    if (tail && tail.toLowerCase() !== 'cancellation') {
      const parsed = parseDateToDateOnly(tail);
      if (parsed) return parsed;
    }
  }
  if (status && !['ok', 'inactive', 'out'].includes(lower)) {
    const parsed = parseDateToDateOnly(status);
    if (parsed) return parsed;
  }
  return null;
}

/** True when status is a cancellation (pending / scheduled / cancelled). */
export function isInsuranceCancellationStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  if (!s || s === 'ok' || s === 'inactive' || s === 'out') return false;
  return (
    s.includes('cancellation') ||
    s.includes('cancelled') ||
    s.includes('canceled')
  );
}

/**
 * Date for the "Cancel date" column — only when status is cancellation.
 * OK / inactive / out must not show expiration or historical last_cancellation_date.
 */
export function getInsuranceCancelDateForDisplay(c: ClientInsurance): string | null {
  if (!isInsuranceCancellationStatus(c.status)) return null;
  return resolveInsuranceCancellationDate(c);
}

function statusImpliesCancellation(c: ClientInsurance): boolean {
  const s = (c.status ?? '').trim().toLowerCase();
  if (!s || s === 'ok') return false;
  if (s === 'inactive' || s === 'out') return false;
  if (
    s.startsWith('cancellation') ||
    s.includes('cancellation') ||
    s.includes('cancelled') ||
    s.includes('canceled')
  ) {
    return true;
  }
  return resolveInsuranceCancellationDate(c) != null;
}

/** True if status is cancellation AND has a date (for Overview warning + popup). */
export function isClientInsuranceCancellationWithDate(c: ClientInsurance): boolean {
  if (!statusImpliesCancellation(c)) return false;
  return resolveInsuranceCancellationDate(c) != null;
}

/**
 * Returns whole days until cancellation date.
 * - 0 means today
 * - positive means future date
 * - negative means already passed
 * Only applies when status implies a cancellation (not OK with a historical last_cancellation_date).
 */
export function getDaysUntilCancellation(c: ClientInsurance): number | null {
  if (!statusImpliesCancellation(c)) return null;
  const dateOnly = resolveInsuranceCancellationDate(c);
  if (!dateOnly) return null;
  const [y, m, d] = dateOnly.split('-').map(Number);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(y, m - 1, d).getTime();
  return Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
}

/** True when cancellation date is approaching within the next N days (default 7). */
export function isClientInsuranceCancellationSoon(c: ClientInsurance, withinDays = 7): boolean {
  const daysUntil = getDaysUntilCancellation(c);
  return daysUntil != null && daysUntil >= 0 && daysUntil <= withinDays;
}

/** Days before cancellation when worksheet batches should be fully verified. */
export const INSURANCE_FULL_VERIFY_DAYS_BEFORE_CANCELLATION = 30;

/**
 * True when client has scheduled insurance cancellation within the verify window
 * (default: 30 days before cancellation date, including on/after cancellation day).
 */
export function requiresInsuranceFullVerification(
  c: ClientInsurance,
  withinDays = INSURANCE_FULL_VERIFY_DAYS_BEFORE_CANCELLATION
): boolean {
  if (!isClientInsuranceCancellationWithDate(c)) return false;
  const daysUntil = getDaysUntilCancellation(c);
  return daysUntil != null && daysUntil <= withinDays;
}

/** User-facing message when insurance cancellation requires full verification. */
export function getInsuranceCancellationVerifyMessage(c: ClientInsurance): string | null {
  if (!requiresInsuranceFullVerification(c)) return null;
  const daysUntil = getDaysUntilCancellation(c);
  const cancelDate = resolveInsuranceCancellationDate(c);
  const dateLabel = cancelDate
    ? new Date(cancelDate + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'the cancellation date';
  if (daysUntil != null && daysUntil < 0) {
    return `Insurance cancellation date was ${dateLabel}. Mark this batch as fully verified due to insurance.`;
  }
  if (daysUntil === 0) {
    return `Insurance cancels today (${dateLabel}). Mark this batch as fully verified due to insurance.`;
  }
  if (daysUntil != null && daysUntil === 1) {
    return `Insurance cancels tomorrow (${dateLabel}). Mark this batch as fully verified due to insurance.`;
  }
  if (daysUntil != null) {
    return `Insurance cancels in ${daysUntil} days (${dateLabel}). Mark this batch as fully verified due to insurance.`;
  }
  return `Insurance cancellation on ${dateLabel}. Mark this batch as fully verified due to insurance.`;
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

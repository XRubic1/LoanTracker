import type { ClientInsurance, InsuranceVerification } from '@/types';

/** True if insurance verification is missing or older than 7 days (show Overview warning). */
export function insuranceNeedsVerification(verification: InsuranceVerification | null): boolean {
  if (!verification?.last_checked_date) return true;
  const checked = new Date(verification.last_checked_date);
  if (isNaN(checked.getTime())) return true;
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSince = (now.getTime() - checked.getTime()) / msPerDay;
  return daysSince > 7;
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

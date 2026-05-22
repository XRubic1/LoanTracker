import type { Client } from '@/types';

const DEFAULT_VERIFICATION_DAYS = 30;

/** Today as YYYY-MM-DD in local time. */
function todayDateOnly(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Add calendar days to a YYYY-MM-DD string; returns YYYY-MM-DD. */
function addDaysDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** True when verification period is set to "always" (permanently verified). */
export function isClientVerificationAlways(c: Client): boolean {
  return Boolean(c.verification_always);
}

/** Client is on the new-client verification track (includes always-verified). */
export function isClientVerificationTracked(c: Client): boolean {
  return Boolean(c.is_new_client) || isClientVerificationAlways(c);
}

/** True when new-client verification is satisfied (always or manually reviewed). */
export function isClientFullyVerified(c: Client): boolean {
  if (!isClientVerificationTracked(c)) return true;
  if (isClientVerificationAlways(c)) return true;
  return Boolean(c.new_client_reviewed);
}

/**
 * Parse verification period field: number of days or the word "always".
 */
export function parseVerificationPeriodInput(input: string): {
  verification_days: number;
  verification_always: boolean;
  new_client_reviewed: boolean;
} {
  const trimmed = input.trim();
  if (trimmed.toLowerCase() === 'always') {
    return {
      verification_days: DEFAULT_VERIFICATION_DAYS,
      verification_always: true,
      new_client_reviewed: true,
    };
  }
  const n = parseInt(trimmed, 10);
  const days = !isNaN(n) && n > 0 ? n : DEFAULT_VERIFICATION_DAYS;
  return {
    verification_days: days,
    verification_always: false,
    new_client_reviewed: false,
  };
}

/** Display label for verification period column. */
export function getVerificationPeriodLabel(c: Client): string {
  if (isClientVerificationAlways(c)) return 'Always';
  if (!c.is_new_client) return '—';
  if (isClientFullyVerified(c)) return 'Reviewed';
  const daysUntil = getDaysUntilNewClientReview(c);
  if (daysUntil != null && daysUntil > 0) return `${daysUntil}d left`;
  if (isNewClientNeedsReview(c)) return 'Review due';
  if (!c.started_date?.trim()) return `${c.verification_days ?? DEFAULT_VERIFICATION_DAYS} days`;
  return `${c.verification_days ?? DEFAULT_VERIFICATION_DAYS} days`;
}

/** Review due date for a new client (started_date + verification_days). Null if always verified. */
export function getNewClientReviewDueDate(c: Client): string | null {
  if (!c.is_new_client || !c.started_date?.trim() || isClientVerificationAlways(c)) return null;
  const period = c.verification_days ?? DEFAULT_VERIFICATION_DAYS;
  return addDaysDateOnly(c.started_date.trim(), Math.max(0, period));
}

/** Whole days from today until review due (negative if overdue). */
export function getDaysUntilNewClientReview(c: Client): number | null {
  if (isClientVerificationAlways(c)) return null;
  const due = getNewClientReviewDueDate(c);
  if (!due) return null;
  const [y, m, d] = due.split('-').map(Number);
  const [ty, tm, td] = todayDateOnly().split('-').map(Number);
  const dueMs = new Date(y, m - 1, d).getTime();
  const todayMs = new Date(ty, tm - 1, td).getTime();
  return Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
}

/** True when new-client verification period has ended and review is not marked complete. */
export function isNewClientNeedsReview(c: Client): boolean {
  if (!isClientVerificationTracked(c)) return false;
  if (isClientVerificationAlways(c) || c.new_client_reviewed) return false;
  if (!c.started_date?.trim()) return false;
  const daysUntil = getDaysUntilNewClientReview(c);
  return daysUntil != null && daysUntil <= 0;
}

/** Active new client still inside verification window (not yet due, not reviewed). */
export function isNewClientInVerificationPeriod(c: Client): boolean {
  if (!isClientVerificationTracked(c)) return false;
  if (isClientVerificationAlways(c) || c.new_client_reviewed) return false;
  if (!c.started_date?.trim()) return false;
  const daysUntil = getDaysUntilNewClientReview(c);
  return daysUntil != null && daysUntil > 0;
}

/** Any new-client row that should surface in alerts (due for review). */
export function getNewClientsNeedingReview(clients: Client[]): Client[] {
  return clients
    .filter(isNewClientNeedsReview)
    .sort((a, b) => {
      const dueA = getNewClientReviewDueDate(a) ?? '';
      const dueB = getNewClientReviewDueDate(b) ?? '';
      return dueA.localeCompare(dueB);
    });
}

/** Build verification period string for form inputs. */
export function formatVerificationPeriodInput(c: Client): string {
  if (isClientVerificationAlways(c)) return 'always';
  return String(c.verification_days ?? DEFAULT_VERIFICATION_DAYS);
}

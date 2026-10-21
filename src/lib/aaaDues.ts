import type { AaaDeduction, AaaDue } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday (YYYY-MM-DD) of the week that contains the given date. */
export function weekStartOf(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? parseIso(date) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return toIso(d);
}

export function weekEndOf(weekStart: string): string {
  return toIso(new Date(parseIso(weekStart).getTime() + 6 * DAY_MS));
}

/** "20 Oct – 26 Oct" */
export function weekLabel(weekStart: string): string {
  const fmt = (iso: string) =>
    parseIso(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(weekStart)} – ${fmt(weekEndOf(weekStart))}`;
}

export function aaaDuePaid(due: Pick<AaaDue, 'deductions'>): number {
  return Math.round(due.deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) * 100) / 100;
}

export function aaaDueRemaining(due: Pick<AaaDue, 'amount' | 'deductions'>): number {
  return Math.max(0, Math.round((due.amount - aaaDuePaid(due)) * 100) / 100);
}

export type AaaDueStatus = 'past_due' | 'due' | 'upcoming';

/** Past due once its week is over (same idea as loans); upcoming if the week hasn't started. */
export function aaaDueStatus(due: Pick<AaaDue, 'weekStart'>, today: Date = new Date()): AaaDueStatus {
  const todayIso = toIso(today);
  if (weekEndOf(due.weekStart) < todayIso) return 'past_due';
  if (due.weekStart > todayIso) return 'upcoming';
  return 'due';
}

/** Deductions in date order. */
export function sortedDeductions(deductions: AaaDeduction[]): AaaDeduction[] {
  return [...deductions].sort((a, b) => a.date.localeCompare(b.date));
}

/** "Mon 20 Oct" */
export function dayLabel(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

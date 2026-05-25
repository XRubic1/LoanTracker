import type { WorksheetEntry } from '@/types';

/** Expected work rate: 2 minutes per invoice. */
export const WORK_MINUTES_PER_INVOICE = 2;

/** Extra allowance on top of invoice time before flagging as slow. */
export const WORK_DURATION_MARGIN_MINUTES = 10;

export type WorkDurationReview = 'slow' | 'fast';

export interface WorkDurationFinding {
  entryId: number;
  previousEntryId: number;
  review: WorkDurationReview;
  gapMinutes: number;
  expectedMaxMinutes: number;
  expectedMinMinutes: number;
  previousInvoiceCount: number;
}

/** Max minutes allowed between logging batch N and batch N+1 (invoices × 2 + margin). */
export function expectedMaxMinutesBetweenBatches(invoiceCount: number): number {
  const n = Math.max(0, Math.round(invoiceCount));
  return n * WORK_MINUTES_PER_INVOICE + WORK_DURATION_MARGIN_MINUTES;
}

/** Minimum minutes expected before the next batch (invoices × 2, no margin). Faster → review. */
export function expectedMinMinutesBetweenBatches(invoiceCount: number): number {
  const n = Math.max(0, Math.round(invoiceCount));
  return n * WORK_MINUTES_PER_INVOICE;
}

function parseLoggedAt(entry: WorksheetEntry): number {
  if (entry.created_at) {
    const t = new Date(entry.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  const [y, m, d] = entry.work_date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

function roundMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

/**
 * Compare consecutive batches per user (same work day).
 * Flags the later batch when gap since previous log is too long or suspiciously short.
 */
export function analyzeWorkDurationBetweenBatches(
  entries: WorksheetEntry[]
): Map<number, WorkDurationFinding> {
  const findings = new Map<number, WorkDurationFinding>();
  const byUser = new Map<string, WorksheetEntry[]>();

  for (const e of entries) {
    const list = byUser.get(e.created_by) ?? [];
    list.push(e);
    byUser.set(e.created_by, list);
  }

  for (const list of byUser.values()) {
    const sorted = [...list].sort((a, b) => parseLoggedAt(a) - parseLoggedAt(b));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.work_date !== prev.work_date) continue;

      const gapMinutes = roundMinutes(parseLoggedAt(curr) - parseLoggedAt(prev));
      const maxAllowed = expectedMaxMinutesBetweenBatches(prev.invoice_count);
      const minExpected = expectedMinMinutesBetweenBatches(prev.invoice_count);

      if (gapMinutes > maxAllowed) {
        findings.set(curr.id, {
          entryId: curr.id,
          previousEntryId: prev.id,
          review: 'slow',
          gapMinutes,
          expectedMaxMinutes: maxAllowed,
          expectedMinMinutes: minExpected,
          previousInvoiceCount: prev.invoice_count,
        });
      } else if (minExpected > 0 && gapMinutes < minExpected) {
        findings.set(curr.id, {
          entryId: curr.id,
          previousEntryId: prev.id,
          review: 'fast',
          gapMinutes,
          expectedMaxMinutes: maxAllowed,
          expectedMinMinutes: minExpected,
          previousInvoiceCount: prev.invoice_count,
        });
      }
    }
  }

  return findings;
}

export function formatWorkDurationIssue(
  entry: WorksheetEntry,
  finding: WorkDurationFinding,
  clientName: string
): string {
  const { review, gapMinutes, expectedMaxMinutes, expectedMinMinutes, previousInvoiceCount } = finding;
  if (review === 'slow') {
    return `${clientName} on ${entry.work_date}: ${gapMinutes} min since previous batch (limit ${expectedMaxMinutes} min for ${previousInvoiceCount} invoices)`;
  }
  return `${clientName} on ${entry.work_date}: only ${gapMinutes} min since previous batch (${previousInvoiceCount} invoices need ≥ ${expectedMinMinutes} min)`;
}

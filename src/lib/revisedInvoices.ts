/** Numbering for revised invoices: 1234 → 1234R → 1234R2 → 1234R3. Shared by the app and the upload function. */

interface FamilyMember {
  invoiceNo: string;
  debtorKey?: number;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Invoice number without a trailing revision mark: 1234R2 → 1234. */
export function stripRevision(invoiceNo: string): string {
  return invoiceNo.trim().replace(/R\d*$/i, '');
}

/** 0 for the original, 1 for R, 2 for R2, and so on; null when it is not part of this family. */
export function revisionNumber(invoiceNo: string, base: string): number | null {
  const no = invoiceNo.trim();
  if (no.toLowerCase() === base.toLowerCase()) return 0;
  const match = new RegExp(`^${escapeRegExp(base)}R(\\d*)$`, 'i').exec(no);
  if (!match) return null;
  return match[1] ? Number(match[1]) : 1;
}

/** The mark for a revision: R, R2, R3… */
export const revisionSuffix = (n: number): string => (n <= 1 ? 'R' : `R${n}`);

/**
 * The original invoice and every revision of it, from a list of search results.
 * Works whether the person picked the original or one of the revisions.
 */
export function findFamily<T extends FamilyMember>(
  results: T[],
  selected: T
): { base: string; members: (T & { revision: number })[]; original: T | null } {
  const stripped = stripRevision(selected.invoiceNo);
  const sameBroker = (i: T) => (selected.debtorKey ? i.debtorKey === selected.debtorKey : true);
  const strippedExists =
    stripped !== selected.invoiceNo.trim() &&
    stripped !== '' &&
    results.some((i) => i.invoiceNo.trim().toLowerCase() === stripped.toLowerCase() && sameBroker(i));
  const base = strippedExists ? stripped : selected.invoiceNo.trim();

  const members: (T & { revision: number })[] = [];
  for (const item of results) {
    const revision = revisionNumber(item.invoiceNo, base);
    if (revision != null && sameBroker(item)) members.push({ ...item, revision });
  }
  members.sort((a, b) => a.revision - b.revision);
  const original = members.find((m) => m.revision === 0) ?? null;
  return { base, members, original };
}

/** The number the next revision gets: one more than the highest so far, and at least 1. */
export function nextRevisionNumber(members: { revision: number }[]): number {
  return Math.max(0, ...members.map((m) => m.revision)) + 1;
}

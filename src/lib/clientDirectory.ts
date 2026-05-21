import type { ClientInsurance } from '@/types';
import { getClientInsuranceStatusLabel } from '@/lib/clientInsuranceUtils';

/** One client pulled from the insurance roster (canonical spelling from insurance). */
export interface ClientDirectoryEntry {
  client: string;
  mc: string;
  statusLabel: string;
  insuranceId: number;
}

function normalizeClientKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Build a deduplicated, sorted client list from client insurance records.
 * First insurance row wins when names match case-insensitively.
 */
export function buildClientDirectoryFromInsurance(
  records: ClientInsurance[]
): ClientDirectoryEntry[] {
  const byKey = new Map<string, ClientDirectoryEntry>();

  for (const record of records) {
    const key = normalizeClientKey(record.client);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, {
      client: record.client.trim(),
      mc: record.mc.trim(),
      statusLabel: getClientInsuranceStatusLabel(record),
      insuranceId: record.id,
    });
  }

  return [...byKey.values()].sort((a, b) =>
    a.client.localeCompare(b.client, undefined, { sensitivity: 'base' })
  );
}

/** Filter directory for autocomplete (client name or MC number). */
export function filterClientDirectory(
  directory: ClientDirectoryEntry[],
  query: string,
  limit = 10
): ClientDirectoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return directory.slice(0, limit);
  return directory
    .filter(
      (entry) =>
        entry.client.toLowerCase().includes(q) || entry.mc.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

/** Case-insensitive exact match from the insurance roster. */
export function findExactClientMatch(
  directory: ClientDirectoryEntry[],
  query: string
): ClientDirectoryEntry | null {
  const qLower = query.trim().toLowerCase();
  if (!qLower) return null;
  return directory.find((e) => e.client.toLowerCase() === qLower) ?? null;
}

/**
 * When the user finishes typing, snap to the canonical insurance client name if recognized.
 */
export function resolveClientOnBlur(
  directory: ClientDirectoryEntry[],
  query: string
): string | null {
  const q = query.trim();
  if (!q) return null;

  const exact = findExactClientMatch(directory, q);
  if (exact) return exact.client;

  const matches = filterClientDirectory(directory, q, 8);
  if (matches.length === 1 && matches[0].client.toLowerCase() === q.toLowerCase()) {
    return matches[0].client;
  }

  return null;
}

/**
 * Best single match for inline suggestion (prefix / casing), or null when already complete.
 */
export function pickBestClientMatch(
  directory: ClientDirectoryEntry[],
  query: string
): ClientDirectoryEntry | null {
  const q = query.trim();
  if (!q) return null;
  const qLower = q.toLowerCase();

  const exact = findExactClientMatch(directory, q);
  if (exact?.client === q) return null;

  const matches = filterClientDirectory(directory, q, 50);
  if (matches.length === 0) return null;

  if (exact) return exact;

  const scored = matches.map((entry) => {
    const name = entry.client.toLowerCase();
    const mc = entry.mc.toLowerCase();
    let score = 0;
    if (name.startsWith(qLower)) score = 100;
    else if (name.includes(qLower)) score = 50;
    else if (mc.startsWith(qLower)) score = 40;
    else if (mc.includes(qLower)) score = 20;
    return { entry, score };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.client.localeCompare(b.entry.client, undefined, { sensitivity: 'base' })
  );

  const best = scored[0]?.entry;
  if (!best) return null;
  if (best.client.toLowerCase() === qLower) return null;

  return best;
}

/** Gray inline suffix for ghost autofill text in the input. */
export function getClientInlineCompletion(
  directory: ClientDirectoryEntry[],
  query: string
): string | null {
  const q = query.trim();
  if (!q) return null;
  const match = pickBestClientMatch(directory, q);
  if (!match) return null;
  if (!match.client.toLowerCase().startsWith(q.toLowerCase())) return null;
  if (q.length >= match.client.length) return null;
  return match.client.slice(q.length);
}

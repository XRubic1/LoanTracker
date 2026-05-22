import type { Client, ClientInsurance, Loan, Reserve } from '@/types';

export type ImportClientSource = 'insurance' | 'loan' | 'reserve';

export interface ImportableClientName {
  name: string;
  sources: ImportClientSource[];
}

/** Normalize client name for deduplication (trim, lowercase). */
export function normalizeClientName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Client names from insurance, loans, and reserves that are not already in the clients registry.
 */
export function getImportableClientNames(
  existingClients: Client[],
  clientInsurance: ClientInsurance[],
  loans: Loan[],
  reserves: Reserve[]
): ImportableClientName[] {
  const existing = new Set(existingClients.map((c) => normalizeClientName(c.name)));
  const byName = new Map<string, ImportableClientName>();

  const add = (raw: string, source: ImportClientSource) => {
    const name = raw.trim();
    if (!name) return;
    const key = normalizeClientName(name);
    if (existing.has(key)) return;
    const row = byName.get(key);
    if (row) {
      if (!row.sources.includes(source)) row.sources.push(source);
    } else {
      byName.set(key, { name, sources: [source] });
    }
  };

  for (const ci of clientInsurance) add(ci.client, 'insurance');
  for (const l of loans) add(l.client, 'loan');
  for (const r of reserves) add(r.client, 'reserve');

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

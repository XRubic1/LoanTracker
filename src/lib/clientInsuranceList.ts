import type { Client, ClientInsurance } from '@/types';
import { normalizeClientName } from '@/lib/importClients';

/** Insurance table row: full insurance record or registry-only client. */
export type ClientInsuranceListItem =
  | { kind: 'insurance'; record: ClientInsurance }
  | { kind: 'registry'; client: Client };

/**
 * Merge client_insurance rows with clients registry entries missing from insurance.
 */
export function buildClientInsuranceList(
  clientInsurance: ClientInsurance[],
  clients: Client[]
): ClientInsuranceListItem[] {
  const insuranceNames = new Set(
    clientInsurance.map((ci) => normalizeClientName(ci.client))
  );

  const items: ClientInsuranceListItem[] = [
    ...clientInsurance.map((record) => ({ kind: 'insurance' as const, record })),
    ...clients
      .filter((c) => !insuranceNames.has(normalizeClientName(c.name)))
      .map((client) => ({ kind: 'registry' as const, client })),
  ];

  return items.sort((a, b) => {
    const nameA = a.kind === 'insurance' ? a.record.client : a.client.name;
    const nameB = b.kind === 'insurance' ? b.record.client : b.client.name;
    return nameA.localeCompare(nameB);
  });
}

/** Display name for a list item. */
export function getInsuranceListItemName(item: ClientInsuranceListItem): string {
  return item.kind === 'insurance' ? item.record.client : item.client.name;
}

/** Tenant owner for team filtering (linked accounts share insurance read-only). */
export function getInsuranceListItemOwnerId(item: ClientInsuranceListItem): string | null | undefined {
  return item.kind === 'insurance' ? item.record.owner_id : item.client.owner_id;
}

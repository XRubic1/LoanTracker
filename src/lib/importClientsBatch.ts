import { normalizeClientName } from '@/lib/importClients';
import type { ClientImportPreviewRow } from '@/lib/importClientsExcel';
import type { Client, ClientInsurance } from '@/types';

export interface ClientImportBatch {
  toAdd: Omit<Client, 'id'>[];
  toUpdate: Client[];
  toDelete: Client[];
  toAddInsurance: Array<{ client: string; mc: string; dot: string }>;
}

/** Build add/update/delete lists from preview rows and import options. */
export function buildClientImportBatch(
  preview: ClientImportPreviewRow[],
  existingClients: Client[],
  existingInsurance: ClientInsurance[],
  options: { overrideExisting: boolean; deleteNotInFile: boolean }
): ClientImportBatch {
  const clientsById = new Map(existingClients.map((c) => [c.id, c]));
  const insuranceClientNames = new Set(
    existingInsurance.map((ci) => normalizeClientName(ci.client))
  );

  const toAdd: Omit<Client, 'id'>[] = [];
  const toUpdate: Client[] = [];
  const toAddInsurance: Array<{ client: string; mc: string; dot: string }> = [];
  const insuranceQueuedNames = new Set<string>();

  for (const row of preview) {
    if (row.status === 'invalid') continue;
    const mc = row.mc?.trim() ?? '';
    const dot = row.dot?.trim() ?? '';
    if (mc || dot) {
      const clientKey = normalizeClientName(row.payload.name);
      if (!insuranceClientNames.has(clientKey) && !insuranceQueuedNames.has(clientKey)) {
        toAddInsurance.push({ client: row.payload.name.trim(), mc, dot });
        insuranceQueuedNames.add(clientKey);
      }
    }
    if (row.status === 'new') {
      toAdd.push(row.payload);
      continue;
    }
    if (row.status === 'override' && row.existingClientId != null) {
      const existing = clientsById.get(row.existingClientId);
      if (existing) {
        toUpdate.push({ ...existing, ...row.payload, id: existing.id, owner_id: existing.owner_id });
      }
      continue;
    }
    if (row.status === 'duplicate' && options.overrideExisting && row.existingClientId != null) {
      const existing = clientsById.get(row.existingClientId);
      if (existing) {
        toUpdate.push({ ...existing, ...row.payload, id: existing.id, owner_id: existing.owner_id });
      }
    }
  }

  const namesInFile = new Set(
    preview
      .filter((r) => r.status !== 'invalid')
      .map((r) => normalizeClientName(r.payload.name))
  );

  const toDelete =
    options.deleteNotInFile && namesInFile.size > 0
      ? existingClients.filter((c) => !namesInFile.has(normalizeClientName(c.name)))
      : [];

  return { toAdd, toUpdate, toDelete, toAddInsurance };
}

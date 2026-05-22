import type { Client, ClientInsurance, TeamMember, WorksheetEntry } from '@/types';
import { isNewClientNeedsReview } from '@/lib/clientUtils';
import {
  getInsuranceCancellationVerifyMessage,
  requiresInsuranceFullVerification,
} from '@/lib/clientInsuranceUtils';
import { normalizeClientName } from '@/lib/importClients';

export interface WorksheetIssue {
  entryId: number;
  type:
    | 'unverified'
    | 'warning_note'
    | 'new_client_review'
    | 'missing_client'
    | 'insurance_cancellation'
    | 'unknown_client';
  message: string;
}

/** Shown when a worksheet client is not on the registry. */
export const WORKSHEET_UNKNOWN_CLIENT_MESSAGE =
  'This client is not on the client list. Ask your account executive to add them on the Clients tab.';

/** Entry logged with a free-text name (no registry client). */
export function isWorksheetUnknownClientEntry(entry: WorksheetEntry): boolean {
  return entry.client_id == null && Boolean(entry.client_name?.trim());
}

/** Display name for a worksheet row. */
export function getWorksheetEntryDisplayName(
  entry: WorksheetEntry,
  clientsById: Map<number, Client>
): string {
  if (entry.client_id != null) {
    return clientsById.get(entry.client_id)?.name ?? entry.client_name?.trim() ?? '—';
  }
  return entry.client_name?.trim() ?? '—';
}

/** Match typed name to a registry client, if any. */
export function findRegistryClientByName(nameInput: string, clients: Client[]): Client | null {
  const trimmed = nameInput.trim();
  if (!trimmed) return null;
  const key = normalizeClientName(trimmed);
  return clients.find((c) => normalizeClientName(c.name) === key) ?? null;
}

/** Resolve client field for save: registry id or unknown free-text name. */
export function resolveWorksheetClientInput(
  nameInput: string,
  clients: Client[]
): { client_id: number | null; client_name: string | null; isUnknown: boolean } {
  const trimmed = nameInput.trim();
  if (!trimmed) {
    return { client_id: null, client_name: null, isUnknown: false };
  }
  const match = findRegistryClientByName(trimmed, clients);
  if (match) {
    return { client_id: match.id, client_name: null, isUnknown: false };
  }
  return { client_id: null, client_name: trimmed, isUnknown: true };
}

export interface WorksheetClientAlertInfo {
  warningNote: string | null;
  cancellationMessage: string | null;
  requiresFullVerification: boolean;
}

/** Match registry client to an insurance row by normalized name. */
export function findInsuranceForClient(
  client: Client,
  insuranceList: ClientInsurance[]
): ClientInsurance | null {
  const key = normalizeClientName(client.name);
  return insuranceList.find((ci) => normalizeClientName(ci.client) === key) ?? null;
}

/** Alerts to show when logging worksheet work for a client. */
export function getWorksheetClientAlerts(
  client: Client,
  insurance: ClientInsurance | null
): WorksheetClientAlertInfo {
  const warningNote = client.warning_note?.trim() || null;
  const cancellationMessage = insurance ? getInsuranceCancellationVerifyMessage(insurance) : null;
  const requiresFullVerification = insurance ? requiresInsuranceFullVerification(insurance) : false;
  return { warningNote, cancellationMessage, requiresFullVerification };
}

export function hasWorksheetClientAlerts(alerts: WorksheetClientAlertInfo): boolean {
  return !!(alerts.warningNote || alerts.cancellationMessage);
}

/** Detect issues on worksheet entries for owner review. */
export function getWorksheetIssues(
  entries: WorksheetEntry[],
  clientsById: Map<number, Client>,
  insuranceList: ClientInsurance[] = []
): WorksheetIssue[] {
  const issues: WorksheetIssue[] = [];
  for (const e of entries) {
    if (isWorksheetUnknownClientEntry(e)) {
      const name = getWorksheetEntryDisplayName(e, clientsById);
      issues.push({
        entryId: e.id,
        type: 'unknown_client',
        message: `${name} on ${e.work_date}: not on client list — ask account executive to add`,
      });
      if (!e.verified) {
        issues.push({
          entryId: e.id,
          type: 'unverified',
          message: `${name} on ${e.work_date}: not verified`,
        });
      }
      continue;
    }

    if (e.client_id == null) continue;

    const client = clientsById.get(e.client_id);
    if (!client) {
      issues.push({
        entryId: e.id,
        type: 'missing_client',
        message: `Entry #${e.id}: client record missing`,
      });
      continue;
    }
    const insurance = findInsuranceForClient(client, insuranceList);
    const alerts = getWorksheetClientAlerts(client, insurance);

    if (!e.verified) {
      issues.push({
        entryId: e.id,
        type: 'unverified',
        message: `${client.name} on ${e.work_date}: not verified`,
      });
    }
    if (alerts.requiresFullVerification && !e.verified) {
      issues.push({
        entryId: e.id,
        type: 'insurance_cancellation',
        message: `${client.name}: insurance cancellation — must be fully verified`,
      });
    }
    if (client.warning_note?.trim()) {
      issues.push({
        entryId: e.id,
        type: 'warning_note',
        message: `${client.name}: ${client.warning_note.trim()}`,
      });
    }
    if (isNewClientNeedsReview(client)) {
      issues.push({
        entryId: e.id,
        type: 'new_client_review',
        message: `${client.name}: new-client review overdue`,
      });
    }
  }
  return issues;
}

/** Resolve display label for worksheet entry author. */
export function getWorksheetAuthorLabel(
  createdBy: string,
  ownerId: string,
  teamMembers: TeamMember[],
  ownerLabel = 'Owner'
): string {
  if (createdBy === ownerId) return ownerLabel;
  const member = teamMembers.find((m) => m.member_id === createdBy);
  return member?.email ?? createdBy.slice(0, 8);
}

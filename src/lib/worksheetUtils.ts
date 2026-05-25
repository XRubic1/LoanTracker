import type { Client, ClientInsurance, TeamMember, WorksheetEntry } from '@/types';
import { isNewClientNeedsReview } from '@/lib/clientUtils';
import {
  analyzeWorkDurationBetweenBatches,
  formatWorkDurationIssue,
  type WorkDurationFinding,
} from '@/lib/worksheetTiming';
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
    | 'unknown_client'
    | 'work_duration_slow'
    | 'work_duration_fast';
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

export type WorksheetEntryFlagType =
  | 'unknown'
  | 'unverified'
  | 'warning'
  | 'cancellation'
  | 'new_client'
  | 'group'
  | 'timing_slow'
  | 'timing_fast';

export interface WorksheetEntryFlag {
  type: WorksheetEntryFlagType;
  label: string;
  title?: string;
}

function appendTimingFlags(
  flags: WorksheetEntryFlag[],
  entry: WorksheetEntry,
  durationFindings?: Map<number, WorkDurationFinding>
): void {
  const timing = durationFindings?.get(entry.id);
  if (timing?.review === 'slow') {
    flags.push({
      type: 'timing_slow',
      label: 'Slow pace',
      title: `${timing.gapMinutes} min since previous batch (max ${timing.expectedMaxMinutes} min for ${timing.previousInvoiceCount} invoices)`,
    });
  } else if (timing?.review === 'fast') {
    flags.push({
      type: 'timing_fast',
      label: 'Fast pace',
      title: `Only ${timing.gapMinutes} min since previous batch (min ${timing.expectedMinMinutes} min for ${timing.previousInvoiceCount} invoices)`,
    });
  }
}

/** Short labels for owner activity / audit tables (no long alert paragraphs). */
export function getWorksheetEntryFlags(
  entry: WorksheetEntry,
  clientsById: Map<number, Client>,
  insuranceList: ClientInsurance[] = [],
  durationFindings?: Map<number, WorkDurationFinding>
): WorksheetEntryFlag[] {
  const flags: WorksheetEntryFlag[] = [];

  if (isWorksheetUnknownClientEntry(entry)) {
    flags.push({ type: 'unknown', label: 'Not listed', title: WORKSHEET_UNKNOWN_CLIENT_MESSAGE });
    if (!entry.verified) {
      flags.push({ type: 'unverified', label: 'Unverified' });
    }
    appendTimingFlags(flags, entry, durationFindings);
    return flags;
  }

  if (entry.client_id == null) {
    appendTimingFlags(flags, entry, durationFindings);
    return flags;
  }

  const client = clientsById.get(entry.client_id);
  if (!client) {
    appendTimingFlags(flags, entry, durationFindings);
    return flags;
  }

  const insurance = findInsuranceForClient(client, insuranceList);
  const alerts = getWorksheetClientAlerts(client, insurance);

  if (!entry.verified) {
    flags.push({
      type: 'unverified',
      label: alerts.requiresFullVerification ? 'Must verify' : 'Unverified',
      title: alerts.requiresFullVerification ? alerts.cancellationMessage ?? undefined : undefined,
    });
  }
  if (alerts.warningNote) {
    flags.push({ type: 'warning', label: 'Warning', title: alerts.warningNote });
  }
  if (alerts.cancellationMessage && entry.verified) {
    flags.push({ type: 'cancellation', label: 'Insurance', title: alerts.cancellationMessage });
  }
  if (isNewClientNeedsReview(client)) {
    flags.push({ type: 'new_client', label: 'New client', title: 'New-client review overdue' });
  }
  if (entry.group_work) {
    flags.push({ type: 'group', label: 'Group' });
  }

  appendTimingFlags(flags, entry, durationFindings);
  return flags;
}

export function entryHasAttentionFlags(flags: WorksheetEntryFlag[]): boolean {
  return flags.some((f) => f.type !== 'group');
}

export { analyzeWorkDurationBetweenBatches, type WorkDurationFinding };

/** Detect issues on worksheet entries for owner review. */
export function getWorksheetIssues(
  entries: WorksheetEntry[],
  clientsById: Map<number, Client>,
  insuranceList: ClientInsurance[] = []
): WorksheetIssue[] {
  const issues: WorksheetIssue[] = [];
  const durationFindings = analyzeWorkDurationBetweenBatches(entries);

  for (const e of entries) {
    const duration = durationFindings.get(e.id);
    if (duration) {
      const name = getWorksheetEntryDisplayName(e, clientsById);
      issues.push({
        entryId: e.id,
        type: duration.review === 'slow' ? 'work_duration_slow' : 'work_duration_fast',
        message: formatWorkDurationIssue(e, duration, name),
      });
    }
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

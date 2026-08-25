/**
 * BrokerSnapshot API v2 helpers: MC parsing, types, cancellation detection.
 * Used by the edge function (via _shared copy) and frontend for display.
 */

export const BROKERSNAPSHOT_API_BASE = 'https://brokersnapshot.com/api/v2';

/** includeInsurance: 1=active/pending, 2=history, 4=rejected */
export const INCLUDE_INSURANCE_FLAGS = '7';

/**
 * Statuses eligible for BrokerSnapshot check.
 * Out/Inactive are included so active insurance can restore them to OK.
 */
export function isBrokerSnapshotEligibleStatus(_status: string | null | undefined): boolean {
  return true;
}

/** Clients eligible for BrokerSnapshot sync on one owner account (not linked teams). */
export function isBrokerSnapshotSyncClient(
  record: { owner_id?: string | null; mc?: string | null; status?: string | null },
  ownerId: string
): boolean {
  return (
    record.owner_id === ownerId &&
    (record.mc ?? '').trim().length > 0 &&
    isBrokerSnapshotEligibleStatus(record.status)
  );
}

/** Parsed MC docket for API query params. */
export interface McDocket {
  prefix: 'MC';
  docket: number;
}

/** Minimal client insurance fields needed for detection. */
export interface ClientInsuranceSnapshot {
  id: number;
  client: string;
  mc: string;
  dot: string;
  status: string;
  expiration_date: string | null;
}

export interface BrokerSnapshotInsuranceHistory {
  effective_date?: string;
  cancel_effective_date?: string;
  cancel_method?: number;
  cancel_form?: number;
  company_name?: string;
  policy_number?: string;
  insurance_type?: number;
  form_code?: number;
  [key: string]: unknown;
}

export interface BrokerSnapshotInsuranceActive {
  effective_date?: string;
  posted_date?: string;
  company_name?: string;
  policy_number?: string;
  cancel_effective_date?: string;
  [key: string]: unknown;
}

export interface BrokerSnapshotInsuranceRequired {
  bipd_req?: number;
  bond_req?: boolean;
  bipd_file?: number;
  bond_file?: boolean;
  [key: string]: unknown;
}

export interface BrokerSnapshotAuthority {
  OperatingStatus?: string;
  operating_status?: string;
  [key: string]: unknown;
}

export interface BrokerSnapshotCompanyData {
  Id?: string;
  dot_number?: number;
  prefix?: string;
  docket_number?: number;
  General?: { name?: string; status_code?: string };
  Authority?: BrokerSnapshotAuthority;
  InsuranceRequired?: BrokerSnapshotInsuranceRequired;
  ActiveInsurances?: BrokerSnapshotInsuranceActive[];
  HistoryInsurances?: BrokerSnapshotInsuranceHistory[];
  RejectedInsurances?: BrokerSnapshotInsuranceHistory[];
  [key: string]: unknown;
}

export interface BrokerSnapshotApiResponse {
  Success: boolean;
  Data?: BrokerSnapshotCompanyData;
  Message?: string;
}

export interface BrokerSnapshotResponseSummary {
  company_name?: string;
  dot_number?: number;
  active_policy_count: number;
  history_policy_count: number;
  latest_cancel_date?: string;
  /** Earliest upcoming cancellation (FMCSA pending cancellation date). */
  pending_cancellation_date?: string;
  has_pending_cancellation?: boolean;
  operating_status?: string;
  /** True when there is no current active insurance (not Authority status). */
  is_out_of_service?: boolean;
}

/**
 * App status update driven by CURRENT insurance coverage.
 * Authority / historical operating status is never used to force Out.
 */
export type InsuranceCoverageAppStatus = 'OK' | 'inactive';

export interface DetectedInsuranceCoverageUpdate {
  /** Human-readable reason (active insurance / no coverage). */
  reason: string;
  /** Authority text kept for logs only — not used to decide Out. */
  operating_status?: string;
  app_status: InsuranceCoverageAppStatus;
  active_policy_count: number;
  suggested_dot?: string;
}

/** @deprecated Use DetectedInsuranceCoverageUpdate — Authority OOS is no longer applied. */
export type OperatingStatusAppStatus = InsuranceCoverageAppStatus;
/** @deprecated Use DetectedInsuranceCoverageUpdate */
export type DetectedOperatingStatusIssue = DetectedInsuranceCoverageUpdate;

export type CancellationSuggestionReason = 'pending' | 'lapsed';

export interface DetectedCancellation {
  suggested_cancellation_date: string;
  suggested_dot?: string;
  policy_number?: string;
  insurance_company?: string;
  reason: CancellationSuggestionReason;
  source_data: Record<string, unknown>;
}

interface CancellationCandidate {
  date: string;
  source: string;
  policy_number?: string;
  insurance_company?: string;
  effective_date?: string;
  raw?: Record<string, unknown>;
}

/**
 * Parse MC string into prefix + docket number.
 * Handles: MC-123456, MC 123456, 123456.
 */
export function parseMcDocket(mc: string): McDocket | null {
  const trimmed = (mc ?? '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/^MC[-\s]*/i, '').replace(/\D/g, '');
  const docket = parseInt(digits, 10);
  if (!docket || isNaN(docket)) return null;
  return { prefix: 'MC', docket };
}

/** Normalize date string to YYYY-MM-DD for comparison. */
export function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayDateOnly(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/** FMCSA uses this date when no cancellation is scheduled (open-ended policy). */
export const FMCSA_NO_CANCEL_DATE = '2035-01-01';

/** API may return snake_case or PascalCase depending on serialization. */
const CANCELLATION_DATE_FIELDS = [
  'cancel_effective_date',
  'CancelEffectiveDate',
  'cancellation_date',
  'CancellationDate',
  'cancelEffectiveDate',
] as const;

/** Add calendar years to a YYYY-MM-DD date. */
function addYearsToDate(dateOnly: string, years: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** True when a cancel date is a real FMCSA cancellation, not a placeholder. */
export function isMeaningfulCancellationDate(date: string): boolean {
  if (date === FMCSA_NO_CANCEL_DATE) return false;
  const today = todayDateOnly();
  // Pending cancellations are filed 30+ days out; FMCSA placeholders are far-future.
  if (date > addYearsToDate(today, 2)) return false;
  return true;
}

/** Pull cancellation dates from insurance records (date fields only — not cancel_method/cancel_form). */
export function extractCancellationDatesFromRecord(
  record: Record<string, unknown> | null | undefined
): string[] {
  if (!record) return [];
  const dates: string[] = [];
  for (const key of CANCELLATION_DATE_FIELDS) {
    const parsed = toDateOnly(record[key]);
    if (parsed && isMeaningfulCancellationDate(parsed)) dates.push(parsed);
  }
  return dates;
}

function toCancellationCandidates(
  source: string,
  record: Record<string, unknown>
): CancellationCandidate[] {
  return extractCancellationDatesFromRecord(record).map((date) => ({
    date,
    source,
    policy_number: record.policy_number as string | undefined,
    insurance_company: record.company_name as string | undefined,
    effective_date: record.effective_date as string | undefined,
    raw: record,
  }));
}

/**
 * Collect cancellation dates from all insurance sections (for history / logging).
 */
export function collectCancellationCandidates(
  data: BrokerSnapshotCompanyData | undefined
): CancellationCandidate[] {
  if (!data) return [];
  const out: CancellationCandidate[] = [];

  for (const h of data.HistoryInsurances ?? []) {
    out.push(...toCancellationCandidates('HistoryInsurances', h));
  }
  for (const a of data.ActiveInsurances ?? []) {
    out.push(...toCancellationCandidates('ActivePendingInsurances', a));
  }
  for (const r of data.RejectedInsurances ?? []) {
    out.push(...toCancellationCandidates('RejectedInsurances', r));
  }
  if (data.InsuranceRequired) {
    out.push(
      ...toCancellationCandidates('InsuranceRequired', data.InsuranceRequired)
    );
  }

  return out;
}

/** Pending cancellation candidates — active policies first (FMCSA pending cancel lives here). */
function collectPendingCancellationCandidates(
  data: BrokerSnapshotCompanyData | undefined
): CancellationCandidate[] {
  if (!data) return [];
  const active = (data.ActiveInsurances ?? []).flatMap((a) =>
    toCancellationCandidates('ActivePendingInsurances', a)
  );
  if (active.length > 0) return active;

  if (data.InsuranceRequired) {
    return toCancellationCandidates('InsuranceRequired', data.InsuranceRequired);
  }
  return [];
}

/** Next upcoming cancellation date (earliest meaningful future date on active insurance). */
export function findPendingCancellation(
  data: BrokerSnapshotCompanyData | undefined
): CancellationCandidate | null {
  const today = todayDateOnly();
  const future = collectPendingCancellationCandidates(data)
    .filter((c) => c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return future[0] ?? null;
}

/** Build Company API request path from MC only (DOT is never sent). */
export function buildCompanyRequestPath(mc: string, _dot?: string): string | null {
  const parsed = parseMcDocket(mc);
  if (!parsed) return null;
  const params = new URLSearchParams({
    prefix: parsed.prefix,
    docket: String(parsed.docket),
    include: '3',
    includeInsurance: INCLUDE_INSURANCE_FLAGS,
  });
  return `/Company?${params.toString()}`;
}

/** Format date for human-readable insight text. */
export function formatCancellationInsightDate(dateOnly: string): string {
  const d = new Date(dateOnly + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Read FMCSA operating status from Company payload (Authority, then General). */
export function getOperatingStatus(data: BrokerSnapshotCompanyData | undefined): string | undefined {
  if (!data) return undefined;
  const fromAuthority =
    data.Authority?.OperatingStatus ?? data.Authority?.operating_status ?? undefined;
  if (fromAuthority && String(fromAuthority).trim()) return String(fromAuthority).trim();
  const fromGeneral = data.General?.status_code;
  if (fromGeneral && String(fromGeneral).trim()) return String(fromGeneral).trim();
  return undefined;
}

/**
 * Authority operating-status text is logged only — never maps to app "out".
 * Kept for backward-compatible call sites; always returns null.
 */
export function mapOperatingStatusToAppStatus(
  _operatingStatus: string | null | undefined
): OperatingStatusAppStatus | null {
  return null;
}

/**
 * Status updates from CURRENT ActiveInsurances only (not Authority / history).
 * If BrokerSnapshot shows active insurance, never leave the client as Out/Inactive
 * just because Authority says "Not Authorized" or "Out Of Service".
 * Pending cancellations stay on the suggestion path.
 */
export function detectInsuranceCoverageUpdate(
  record: ClientInsuranceSnapshot,
  data: BrokerSnapshotCompanyData | undefined
): DetectedInsuranceCoverageUpdate | null {
  if (!data) return null;

  const activeCount = (data.ActiveInsurances ?? []).length;
  const operatingStatus = getOperatingStatus(data);
  const suggestedDot =
    data.dot_number && !(record.dot ?? '').trim() ? String(data.dot_number) : undefined;
  const current = (record.status ?? '').trim().toLowerCase();

  // Current coverage is active — restore OK if stuck as out/inactive from Authority.
  if (activeCount > 0 && (current === 'out' || current === 'inactive')) {
    return {
      reason: 'active_insurance',
      operating_status: operatingStatus,
      app_status: 'OK',
      active_policy_count: activeCount,
      suggested_dot: suggestedDot,
    };
  }

  return null;
}

/** @deprecated Use detectInsuranceCoverageUpdate */
export function detectOperatingStatusIssue(
  record: ClientInsuranceSnapshot,
  data: BrokerSnapshotCompanyData | undefined
): DetectedInsuranceCoverageUpdate | null {
  return detectInsuranceCoverageUpdate(record, data);
}

/** Extract summary fields from API response for logging. */
export function buildResponseSummary(data: BrokerSnapshotCompanyData | undefined): BrokerSnapshotResponseSummary {
  const active = data?.ActiveInsurances ?? [];
  const history = data?.HistoryInsurances ?? [];
  const pending = findPendingCancellation(data);
  const operatingStatus = getOperatingStatus(data);
  let latestCancel: string | undefined;
  const today = todayDateOnly();
  for (const c of collectCancellationCandidates(data)) {
    // Past cancellations only — ignore future placeholders in history.
    if (c.date > today) continue;
    if (!latestCancel || c.date > latestCancel) latestCancel = c.date;
  }
  return {
    company_name: data?.General?.name,
    dot_number: data?.dot_number,
    active_policy_count: active.length,
    history_policy_count: history.length,
    latest_cancel_date: latestCancel,
    pending_cancellation_date: pending?.date,
    has_pending_cancellation: !!pending,
    operating_status: operatingStatus,
    // Coverage gap flag — not Authority operating status.
    is_out_of_service: active.length === 0 && !pending,
  };
}

/** True if current status already reflects a cancellation with this date. */
function alreadyMatchesCancellation(record: ClientInsuranceSnapshot, cancelDate: string): boolean {
  const status = (record.status ?? '').trim().toLowerCase();
  const exp = toDateOnly(record.expiration_date);
  if (status.includes('cancellation') && exp === cancelDate) return true;
  return false;
}

/**
 * Detect pending FMCSA insurance cancellation (future cancel_effective_date / cancellation date).
 * Matches BrokerSnapshot insight: "pending insurance cancellation effective on …"
 */
export function detectCancellationSuggestion(
  record: ClientInsuranceSnapshot,
  data: BrokerSnapshotCompanyData | undefined
): DetectedCancellation | null {
  if (!data) return null;

  const suggestedDot =
    data.dot_number && !(record.dot ?? '').trim() ? String(data.dot_number) : undefined;

  const pending = findPendingCancellation(data);
  if (pending) {
    const alreadyRecorded = alreadyMatchesCancellation(record, pending.date);
    const insightDate = formatCancellationInsightDate(pending.date);
    return {
      suggested_cancellation_date: pending.date,
      suggested_dot: suggestedDot,
      policy_number: pending.policy_number,
      insurance_company: pending.insurance_company,
      reason: 'pending',
      source_data: {
        reason: 'pending',
        insight: `Pending insurance cancellation effective on ${insightDate}.`,
        fmcsa_note: 'This entity has a pending insurance cancellation.',
        cancel_effective_date: pending.date,
        source: pending.source,
        effective_date: pending.effective_date,
        policy_number: pending.policy_number,
        company_name: pending.insurance_company,
        dot_number: data.dot_number,
        already_in_insurance: alreadyRecorded,
      },
    };
  }

  // Lapsed coverage is not auto-suggested — it stamped today's date on mass approve.
  return null;
}

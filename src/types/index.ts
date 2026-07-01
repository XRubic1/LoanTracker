/** Provider type for loans */
export type LoanProviderType = 'TruFunding' | 'Other';

/** App model: loan (camelCase) */
export interface Loan {
  id: number;
  owner_id?: string | null;
  client: string;
  ref: string;
  total: number;
  installment: number;
  paidCount: number;
  totalInstallments: number;
  startDate: string;
  freqDays: number;
  paymentDates: string[];
  /** Per-installment notes (same length as totalInstallments, empty string if none). */
  paymentNotes: string[];
  note: string;
  /** TruFunding or Other; when Other, providerName is the custom name. */
  providerType: LoanProviderType;
  /** Custom provider name when providerType === 'Other'. */
  providerName: string;
  /** Fee added to total; effective total = total + factoringFee, installment = effectiveTotal / totalInstallments. */
  factoringFee: number;
  /** When true, loan is hidden from overview/loans lists (client inactive or cannot be completed). */
  hidden: boolean;
}

/** App model: reserve (camelCase) */
export interface Reserve {
  id: number;
  owner_id?: string | null;
  client: string;
  amount: number;
  installments: number;
  date: string;
  freqDays: number;
  note: string;
  paidCount: number;
  deductionDates: string[];
  /** Per-deduction notes (same length as installments, empty string if none). */
  deductionNotes: string[];
}

/** Supabase row: loans table (snake_case) */
export interface LoanRow {
  id: number;
  owner_id: string | null;
  client: string;
  ref: string | null;
  total: number;
  installment: number;
  paid_count: number;
  total_installments: number;
  start_date: string;
  freq_days: number;
  payment_dates: string[];
  payment_notes?: string[];
  note: string | null;
  provider_type?: string;
  provider_name?: string | null;
  factoring_fee?: number;
  hidden?: boolean;
}

/** Supabase row: reserves table (snake_case) */
export interface ReserveRow {
  id: number;
  owner_id: string | null;
  client: string;
  amount: number;
  installments: number;
  date: string;
  freq_days: number;
  note: string | null;
  paid_count: number;
  deduction_dates: string[];
  deduction_notes?: string[];
}

/** AAA entity receiving a payment */
export const AAA_PAYEES = [
  'AAA Lease',
  'AAA Mega Fuel',
  'AAA Equipment',
  'BJK Fuel',
] as const;

export type AaaPayee = (typeof AAA_PAYEES)[number];

/** App model: AAA payment (camelCase) */
export interface AaaPayment {
  id: number;
  owner_id?: string | null;
  client: string;
  payee: AaaPayee;
  amount: number;
  /** Date the payment was made (YYYY-MM-DD). */
  paymentDate: string;
  createdAt: string;
}

/** Supabase row: aaa_payments table (snake_case) */
export interface AaaPaymentRow {
  id: number;
  owner_id: string | null;
  client: string;
  payee: string;
  amount: number;
  payment_date?: string;
  created_at: string;
}

export type PageId =
  | 'overview'
  | 'loans'
  | 'reserves'
  | 'closed'
  | 'aaaPayments'
  | 'users'
  | 'clientInsurance'
  | 'worksheet'
  | 'clients'
  | 'userActivity'
  | 'api'
  | 'admin';

/** Client expense payment method. */
export const CLIENT_EXPENSE_OPTIONS = ['Wire', 'ACH'] as const;
export type ClientExpenseType = (typeof CLIENT_EXPENSE_OPTIONS)[number];

/** Master client registry (per owner). */
export interface Client {
  id: number;
  owner_id?: string | null;
  name: string;
  /** Wire or ACH. */
  expenses: ClientExpenseType | null;
  /** Contact email address(es), semicolon-separated when multiple. */
  email: string | null;
  warning_note: string | null;
  is_new_client: boolean;
  started_date: string | null;
  new_client_reviewed: boolean;
  verification_days: number;
  /** When true, client is always fully verified (no review due). */
  verification_always: boolean;
}

/** Supabase row: clients table (snake_case). */
export interface ClientRow {
  id: number;
  owner_id: string | null;
  name: string;
  expenses: string | null;
  email?: string | null;
  warning_note: string | null;
  is_new_client?: boolean;
  started_date?: string | null;
  new_client_reviewed?: boolean;
  verification_days?: number;
  verification_always?: boolean;
}

/** Worksheet batch entry (per user). */
export interface WorksheetEntry {
  id: number;
  owner_id: string;
  created_by: string;
  work_date: string;
  /** Registry client; null when logged under client_name only. */
  client_id: number | null;
  /** Free-text name when client is not on the Clients list. */
  client_name: string | null;
  invoice_count: number;
  group_work: boolean;
  verified: boolean;
  note: string | null;
  /** When the batch was saved (used for work-duration checks). */
  created_at?: string | null;
}

/** Supabase row: worksheet_entries table (snake_case). */
export interface WorksheetEntryRow {
  id: number;
  owner_id: string;
  created_by: string;
  work_date: string;
  client_id: number | null;
  client_name: string | null;
  invoice_count: number;
  group_work: boolean;
  verified: boolean;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Company group linking multiple owner accounts. */
export interface OwnerCompanyGroup {
  id: number;
  name: string;
  created_at?: string;
  members?: OwnerCompanyGroupMember[];
}

export interface OwnerCompanyGroupMember {
  group_id: number;
  owner_id: string;
  created_at?: string;
  owner_email?: string;
}

/** Provisioned tenant company (super admin creates; team admin claims). */
export type CompanyStatus = 'active' | 'suspended';

export interface Company {
  id: number;
  name: string;
  status: CompanyStatus;
  owner_id: string | null;
  /** Links to owner_company_groups for shared worksheet clients. */
  client_share_group_id?: number | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CompanyInviteRole = 'team_admin' | 'member';

export interface CompanyInvite {
  id: number;
  company_id: number;
  email: string;
  role: CompanyInviteRole;
  allowed_pages: PageId[] | null;
  claimed_at: string | null;
  claimed_by: string | null;
  created_at?: string;
}

/** Another company in the same client-share group. */
export interface CompanyClientLink {
  companyId: number;
  companyName: string;
  ownerId: string;
}

/** Super admin list row with aggregates. */
export interface CompanyAdminRow extends Company {
  teamAdminEmail: string | null;
  teamAdminPending: boolean;
  memberCount: number;
  loanCount: number;
  batchCount: number;
  clientShareGroupId: number | null;
  /** Other companies whose clients appear on worksheets for this team. */
  linkedCompanies: CompanyClientLink[];
}

/** Resolved app role after sign-in. */
export type UserRole = 'platform_admin' | 'team_admin' | 'team_member' | 'standalone';

export interface CompanyContext {
  id: number;
  name: string;
  status: CompanyStatus;
}

/** Platform super-admin row (platform_admins table). */
export interface PlatformAdmin {
  email: string;
  created_at?: string;
}

/** Client insurance: client name, MC/DOT numbers, status (OK, inactive, cancellation, date, etc.). */
export interface ClientInsurance {
  id: number;
  owner_id?: string | null;
  client: string;
  mc: string;
  dot: string;
  /** Display status: OK, inactive, cancellation 02/20, insurance cancelled, or date like 05/26/2026. */
  status: string;
  /** Optional expiration date (when status is or was a date). */
  expiration_date: string | null;
  /** Audit: last date this client was in cancellation (kept when status changes back). */
  last_cancellation_date: string | null;
}

/** Supabase row: client_insurance table (snake_case). */
export interface ClientInsuranceRow {
  id: number;
  owner_id: string | null;
  client: string;
  mc: string;
  dot?: string | null;
  status: string;
  expiration_date: string | null;
  last_cancellation_date?: string | null;
}

/** One row per cancellation event (full history for Audit). */
export interface ClientInsuranceCancellationAudit {
  id: number;
  client_insurance_id: number;
  cancellation_date: string;
  created_at?: string;
}

/** Supabase row: client_insurance_cancellation_audit table (snake_case). */
export interface ClientInsuranceCancellationAuditRow {
  id: number;
  client_insurance_id: number;
  cancellation_date: string;
  created_at?: string;
}

/** Single record per owner: when insurance was last verified and by whom. */
export interface InsuranceVerification {
  id: number;
  owner_id: string | null;
  last_checked_date: string | null;
  checked_by: string | null;
}

/** Supabase row: insurance_verification table (snake_case). */
export interface InsuranceVerificationRow {
  id: number;
  owner_id: string | null;
  last_checked_date: string | null;
  checked_by: string | null;
}

/** BrokerSnapshot sync run status. */
export type BrokerSnapshotSyncStatus = 'running' | 'success' | 'partial' | 'failed';

/** One daily or manual BrokerSnapshot sync run. */
export interface BrokerSnapshotSyncRun {
  id: number;
  status: BrokerSnapshotSyncStatus;
  trigger_source: 'cron' | 'manual';
  clients_checked: number;
  cancellations_found: number;
  errors_count: number;
  error_summary: string | null;
  started_at: string;
  finished_at: string | null;
  created_at?: string;
}

export interface BrokerSnapshotSyncRunRow {
  id: number;
  status: BrokerSnapshotSyncStatus;
  trigger_source: 'cron' | 'manual';
  clients_checked: number;
  cancellations_found: number;
  errors_count: number;
  error_summary: string | null;
  started_at: string;
  finished_at: string | null;
  created_at?: string;
}

/** Per-client API call log during a sync run. */
export interface BrokerSnapshotApiLog {
  id: number;
  sync_run_id: number;
  client_insurance_id: number | null;
  owner_id: string | null;
  client_name: string | null;
  mc: string | null;
  dot: string | null;
  request_path: string | null;
  http_status: number | null;
  success: boolean;
  error_message: string | null;
  response_summary: Record<string, unknown> | null;
  cancellation_detected: boolean;
  cancellation_date: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface BrokerSnapshotApiLogRow {
  id: number;
  sync_run_id: number;
  client_insurance_id: number | null;
  owner_id: string | null;
  client_name: string | null;
  mc: string | null;
  dot: string | null;
  request_path: string | null;
  http_status: number | null;
  success: boolean;
  error_message: string | null;
  response_summary: Record<string, unknown> | null;
  cancellation_detected: boolean;
  cancellation_date: string | null;
  duration_ms: number | null;
  created_at: string;
}

/** Cancellation suggestion pending manual approval. */
export type BrokerSnapshotSuggestionStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface BrokerSnapshotCancellationSuggestion {
  id: number;
  sync_run_id: number | null;
  client_insurance_id: number;
  owner_id: string | null;
  client_name: string | null;
  mc: string | null;
  suggested_cancellation_date: string;
  suggested_dot: string | null;
  policy_number: string | null;
  insurance_company: string | null;
  source_data: Record<string, unknown> | null;
  review_status: BrokerSnapshotSuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface BrokerSnapshotCancellationSuggestionRow {
  id: number;
  sync_run_id: number | null;
  client_insurance_id: number;
  owner_id: string | null;
  client_name: string | null;
  mc: string | null;
  suggested_cancellation_date: string;
  suggested_dot: string | null;
  policy_number: string | null;
  insurance_company: string | null;
  source_data: Record<string, unknown> | null;
  review_status: BrokerSnapshotSuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

/** Team member (owner's invited user) */
export interface TeamMember {
  owner_id: string;
  email: string;
  member_id: string | null;
  created_at: string;
  /** Tab ids this member may access; null = all assignable tabs. */
  allowed_pages: PageId[] | null;
}

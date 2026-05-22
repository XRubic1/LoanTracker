import type {
  Loan,
  Reserve,
  LoanRow,
  ReserveRow,
  TeamMember,
  LoanProviderType,
  Client,
  ClientRow,
  ClientInsurance,
  ClientInsuranceRow,
  ClientInsuranceCancellationAudit,
  ClientInsuranceCancellationAuditRow,
  InsuranceVerification,
  InsuranceVerificationRow,
  AaaPayment,
  AaaPaymentRow,
  AaaPayee,
  WorksheetEntry,
  WorksheetEntryRow,
  OwnerCompanyGroup,
  OwnerCompanyGroupMember,
} from '@/types';
import { AAA_PAYEES, CLIENT_EXPENSE_OPTIONS, type ClientExpenseType, type PageId } from '@/types';
import { DEFAULT_MEMBER_ALLOWED_PAGES, normalizeAllowedPages } from '@/lib/tabPermissions';
import { getSupabase } from './supabase';

/** True when status indicates cancellation and we have an expiration/cancellation date. */
function isCancellationWithDate(status: string, expirationDate: string | null): boolean {
  const s = (status ?? '').trim().toLowerCase();
  if (!s.includes('cancellation')) return false;
  return !!(expirationDate && expirationDate.trim());
}

function clientInsuranceFromRow(row: ClientInsuranceRow | null): ClientInsurance | null {
  if (!row) return null;
  return {
    id: row.id,
    owner_id: row.owner_id ?? undefined,
    client: row.client,
    mc: row.mc,
    status: row.status ?? 'OK',
    expiration_date: row.expiration_date ?? null,
    last_cancellation_date: row.last_cancellation_date ?? null,
  };
}

function clientInsuranceToRow(
  record: ClientInsurance,
  ownerId?: string | null
): Omit<ClientInsuranceRow, 'id'> {
  return {
    owner_id: ownerId ?? record.owner_id ?? null,
    client: record.client,
    mc: record.mc,
    status: record.status ?? 'OK',
    expiration_date: record.expiration_date ?? null,
    last_cancellation_date: isCancellationWithDate(record.status ?? '', record.expiration_date ?? null)
      ? record.expiration_date
      : record.last_cancellation_date ?? null,
  };
}

// --- Clients (master registry) ---

function parseClientExpense(value: string | null | undefined): ClientExpenseType | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  return (CLIENT_EXPENSE_OPTIONS as readonly string[]).includes(v) ? (v as ClientExpenseType) : null;
}

function clientFromRow(row: ClientRow | null): Client | null {
  if (!row) return null;
  const verificationAlways = Boolean(row.verification_always ?? false);
  return {
    id: row.id,
    owner_id: row.owner_id ?? undefined,
    name: row.name,
    expenses: parseClientExpense(row.expenses),
    warning_note: row.warning_note ?? null,
    is_new_client: Boolean(row.is_new_client ?? false) || verificationAlways,
    started_date: row.started_date ?? null,
    new_client_reviewed: Boolean(row.new_client_reviewed ?? false) || verificationAlways,
    verification_days: Number(row.verification_days ?? 30),
    verification_always: verificationAlways,
  };
}

function clientToRow(record: Client, ownerId?: string | null): Omit<ClientRow, 'id'> {
  const verificationAlways = Boolean(record.verification_always ?? false);
  const isNewClient = Boolean(record.is_new_client ?? false) || verificationAlways;
  return {
    owner_id: ownerId ?? record.owner_id ?? null,
    name: record.name.trim(),
    expenses: record.expenses ?? null,
    warning_note: record.warning_note?.trim() || null,
    is_new_client: isNewClient,
    started_date: isNewClient && record.started_date?.trim() ? record.started_date.trim() : null,
    verification_always: isNewClient ? verificationAlways : false,
    new_client_reviewed: isNewClient
      ? Boolean(record.new_client_reviewed || verificationAlways)
      : false,
    verification_days: isNewClient
      ? Math.max(1, Math.round(record.verification_days ?? 30))
      : 30,
  };
}

export async function fetchClients(): Promise<Client[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data as ClientRow[] || []).map((row) => clientFromRow(row)!);
}

export async function insertClient(payload: Omit<Client, 'id'>, ownerId?: string | null): Promise<Client> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = clientToRow({ ...payload, id: 0 }, ownerId);
  const { data, error } = await supabase.from('clients').insert(row).select('*').single();
  if (error) throw error;
  return clientFromRow(data as ClientRow)!;
}

export async function updateClient(id: number, record: Client): Promise<Client> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = clientToRow(record, record.owner_id ?? null);
  const { data, error } = await supabase.from('clients').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return clientFromRow(data as ClientRow)!;
}

export async function deleteClientById(id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// --- Worksheet entries ---

function worksheetEntryFromRow(row: WorksheetEntryRow | null): WorksheetEntry | null {
  if (!row) return null;
  return {
    id: row.id,
    owner_id: row.owner_id,
    created_by: row.created_by,
    work_date: row.work_date,
    client_id: row.client_id ?? null,
    client_name: row.client_name?.trim() || null,
    invoice_count: row.invoice_count ?? 0,
    group_work: Boolean(row.group_work),
    verified: Boolean(row.verified),
    note: row.note ?? null,
  };
}

function worksheetEntryToRow(
  entry: Pick<
    WorksheetEntry,
    'work_date' | 'client_id' | 'client_name' | 'invoice_count' | 'group_work' | 'verified' | 'note'
  >,
  ownerId: string,
  createdBy: string
): Omit<WorksheetEntryRow, 'id'> {
  return {
    owner_id: ownerId,
    created_by: createdBy,
    work_date: entry.work_date,
    client_id: entry.client_id ?? null,
    client_name: entry.client_id == null ? entry.client_name?.trim() || null : null,
    invoice_count: Math.max(0, Math.round(entry.invoice_count ?? 0)),
    group_work: entry.group_work ?? false,
    verified: entry.verified ?? false,
    note: entry.note?.trim() || null,
  };
}

/** Fetches worksheet entries visible to current user (RLS-scoped). */
export async function fetchWorksheetEntries(): Promise<WorksheetEntry[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('worksheet_entries')
    .select('*')
    .order('work_date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return (data as WorksheetEntryRow[] || []).map((row) => worksheetEntryFromRow(row)!);
}

export async function insertWorksheetEntry(
  payload: Omit<WorksheetEntry, 'id' | 'owner_id' | 'created_by'>,
  ownerId: string,
  createdBy: string
): Promise<WorksheetEntry> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = worksheetEntryToRow(payload, ownerId, createdBy);
  const { data, error } = await supabase.from('worksheet_entries').insert(row).select('*').single();
  if (error) throw error;
  return worksheetEntryFromRow(data as WorksheetEntryRow)!;
}

export async function updateWorksheetEntry(id: number, entry: WorksheetEntry): Promise<WorksheetEntry> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = {
    work_date: entry.work_date,
    client_id: entry.client_id ?? null,
    client_name: entry.client_id == null ? entry.client_name?.trim() || null : null,
    invoice_count: Math.max(0, Math.round(entry.invoice_count ?? 0)),
    group_work: entry.group_work ?? false,
    verified: entry.verified ?? false,
    note: entry.note?.trim() || null,
  };
  const { data, error } = await supabase.from('worksheet_entries').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return worksheetEntryFromRow(data as WorksheetEntryRow)!;
}

export async function deleteWorksheetEntryById(id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('worksheet_entries').delete().eq('id', id);
  if (error) throw error;
}

// --- Company groups (platform admin) ---

export async function fetchCompanyGroups(): Promise<OwnerCompanyGroup[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data: groups, error } = await supabase
    .from('owner_company_groups')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  const { data: members, error: memErr } = await supabase.from('owner_company_group_members').select('*');
  if (memErr) throw memErr;
  const memberList = (members ?? []) as OwnerCompanyGroupMember[];
  return (groups ?? []).map((g: { id: number; name: string; created_at?: string }) => ({
    id: g.id,
    name: g.name,
    created_at: g.created_at,
    members: memberList.filter((m) => m.group_id === g.id),
  }));
}

export async function createCompanyGroup(name: string): Promise<OwnerCompanyGroup> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('owner_company_groups').insert({ name: name.trim() }).select('*').single();
  if (error) throw error;
  return { id: data.id, name: data.name, created_at: data.created_at, members: [] };
}

export async function deleteCompanyGroup(groupId: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('owner_company_groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function addOwnerToCompanyGroup(groupId: number, ownerId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('owner_company_group_members').insert({ group_id: groupId, owner_id: ownerId });
  if (error) throw error;
}

export async function removeOwnerFromCompanyGroup(groupId: number, ownerId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('owner_company_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

/** Look up owner_id by account email (auth.users). */
export async function lookupOwnerIdByEmail(email: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('owner_id_by_email', { p_email: email.trim() });
  if (error) throw error;
  return (data as string | null) ?? null;
}

function loanFromRow(row: LoanRow | null): Loan | null {
  if (!row) return null;
  const paymentDates = Array.isArray(row.payment_dates) ? row.payment_dates : [];
  const rawNotes = Array.isArray(row.payment_notes) ? row.payment_notes : [];
  const total = row.total_installments ?? 0;
  const paymentNotes = Array.from({ length: total }, (_, i) => rawNotes[i] ?? '');
  const providerType = (row.provider_type === 'Other' ? 'Other' : 'TruFunding') as LoanProviderType;
  return {
    id: row.id,
    owner_id: row.owner_id ?? undefined,
    client: row.client,
    ref: row.ref ?? '',
    total: Number(row.total),
    installment: Number(row.installment),
    paidCount: row.paid_count ?? 0,
    totalInstallments: total,
    startDate: row.start_date,
    freqDays: row.freq_days ?? 7,
    paymentDates,
    paymentNotes,
    note: row.note ?? '',
    providerType,
    providerName: row.provider_name ?? '',
    factoringFee: Number(row.factoring_fee ?? 0),
    hidden: Boolean(row.hidden ?? false),
  };
}

function loanToRow(loan: Loan, ownerId?: string | null): Omit<LoanRow, 'id'> {
  const total = loan.totalInstallments ?? 0;
  const paymentNotes = (loan.paymentNotes ?? []).slice(0, total);
  while (paymentNotes.length < total) paymentNotes.push('');
  return {
    owner_id: ownerId ?? null,
    client: loan.client,
    ref: loan.ref || null,
    total: loan.total,
    installment: loan.installment,
    paid_count: loan.paidCount ?? 0,
    total_installments: total,
    start_date: loan.startDate,
    freq_days: loan.freqDays ?? 7,
    payment_dates: loan.paymentDates ?? [],
    payment_notes: paymentNotes,
    note: loan.note || null,
    provider_type: loan.providerType ?? 'TruFunding',
    provider_name: loan.providerName || null,
    factoring_fee: loan.factoringFee ?? 0,
    hidden: loan.hidden ?? false,
  };
}

function reserveFromRow(row: ReserveRow | null): Reserve | null {
  if (!row) return null;
  const installments = row.installments ?? 1;
  const rawNotes = Array.isArray(row.deduction_notes) ? row.deduction_notes : [];
  const deductionNotes = Array.from({ length: installments }, (_, i) => rawNotes[i] ?? '');
  return {
    id: row.id,
    owner_id: row.owner_id ?? undefined,
    client: row.client,
    amount: Number(row.amount),
    installments,
    date: row.date,
    freqDays: row.freq_days ?? 7,
    note: row.note ?? '',
    paidCount: row.paid_count ?? 0,
    deductionDates: Array.isArray(row.deduction_dates) ? row.deduction_dates : [],
    deductionNotes,
  };
}

function reserveToRow(reserve: Reserve, ownerId?: string | null): Omit<ReserveRow, 'id'> {
  const installments = reserve.installments ?? 1;
  const deductionNotes = (reserve.deductionNotes ?? []).slice(0, installments);
  while (deductionNotes.length < installments) deductionNotes.push('');
  return {
    owner_id: ownerId ?? null,
    client: reserve.client,
    amount: reserve.amount,
    installments,
    date: reserve.date,
    freq_days: reserve.freqDays ?? 7,
    note: reserve.note || null,
    paid_count: reserve.paidCount ?? 0,
    deduction_dates: reserve.deductionDates ?? [],
    deduction_notes: deductionNotes,
  };
}

export async function fetchLoans(): Promise<Loan[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data as LoanRow[] || []).map((row) => loanFromRow(row)!);
}

export async function fetchReserves(): Promise<Reserve[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('reserves')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data as ReserveRow[] || []).map((row) => reserveFromRow(row)!);
}

export async function insertLoan(loan: Omit<Loan, 'id'>, ownerId?: string | null): Promise<Loan> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = loanToRow(loan as Loan, ownerId);
  const { data, error } = await supabase.from('loans').insert(row).select('*').single();
  if (error) throw error;
  return loanFromRow(data as LoanRow)!;
}

export async function updateLoan(id: number, loan: Loan): Promise<Loan> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = loanToRow(loan, loan.owner_id ?? undefined);
  const { data, error } = await supabase.from('loans').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return loanFromRow(data as LoanRow)!;
}

export async function deleteLoanById(id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('loans').delete().eq('id', id);
  if (error) throw error;
}

export async function insertReserve(reserve: Omit<Reserve, 'id'>, ownerId?: string | null): Promise<Reserve> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = reserveToRow(reserve as Reserve, ownerId);
  const { data, error } = await supabase.from('reserves').insert(row).select('*').single();
  if (error) throw error;
  return reserveFromRow(data as ReserveRow)!;
}

export async function updateReserve(id: number, reserve: Reserve): Promise<Reserve> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = reserveToRow(reserve, reserve.owner_id ?? undefined);
  const { data, error } = await supabase.from('reserves').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return reserveFromRow(data as ReserveRow)!;
}

export async function deleteReserveById(id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('reserves').delete().eq('id', id);
  if (error) throw error;
}

// --- Client Insurance ---

export async function fetchClientInsurance(): Promise<ClientInsurance[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('client_insurance')
    .select('*')
    .order('client', { ascending: true });
  if (error) throw error;
  return (data as ClientInsuranceRow[] || []).map((row) => clientInsuranceFromRow(row)!);
}

export async function insertClientInsurance(
  payload: Omit<ClientInsurance, 'id'>,
  ownerId?: string | null
): Promise<ClientInsurance> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = clientInsuranceToRow({ ...payload, id: 0 }, ownerId);
  const { data, error } = await supabase.from('client_insurance').insert(row).select('*').single();
  if (error) throw error;
  const inserted = clientInsuranceFromRow(data as ClientInsuranceRow)!;
  if (isCancellationWithDate(payload.status ?? '', payload.expiration_date ?? null) && payload.expiration_date) {
    await insertCancellationAuditRow(inserted.id, payload.expiration_date);
  }
  return inserted;
}

export async function updateClientInsurance(id: number, record: ClientInsurance): Promise<ClientInsurance> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = clientInsuranceToRow(record, record.owner_id ?? null);
  const { data, error } = await supabase.from('client_insurance').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = clientInsuranceFromRow(data as ClientInsuranceRow)!;
  if (isCancellationWithDate(record.status ?? '', record.expiration_date ?? null) && record.expiration_date) {
    await insertCancellationAuditRow(id, record.expiration_date);
  }
  return updated;
}

export async function deleteClientInsuranceById(id: number): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('client_insurance').delete().eq('id', id);
  if (error) throw error;
}

// --- Cancellation audit (full history per client) ---

function cancellationAuditFromRow(row: ClientInsuranceCancellationAuditRow | null): ClientInsuranceCancellationAudit | null {
  if (!row) return null;
  return {
    id: row.id,
    client_insurance_id: row.client_insurance_id,
    cancellation_date: row.cancellation_date,
    created_at: row.created_at,
  };
}

/** Inserts one audit row (called when client is saved with cancellation + date). */
async function insertCancellationAuditRow(clientInsuranceId: number, cancellationDate: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('client_insurance_cancellation_audit').insert({
    client_insurance_id: clientInsuranceId,
    cancellation_date: cancellationDate,
  });
}

/** Fetches full cancellation history for a client (for Audit button). Newest first. */
export async function fetchCancellationAuditByClientId(
  clientInsuranceId: number
): Promise<ClientInsuranceCancellationAudit[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('client_insurance_cancellation_audit')
    .select('*')
    .eq('client_insurance_id', clientInsuranceId)
    .order('cancellation_date', { ascending: false });
  if (error) throw error;
  return (data as ClientInsuranceCancellationAuditRow[] || []).map((row) =>
    cancellationAuditFromRow(row)!
  );
}

// --- Insurance verification (one row per owner: last checked date + checked by) ---

function verificationFromRow(row: InsuranceVerificationRow | null): InsuranceVerification | null {
  if (!row) return null;
  return {
    id: row.id,
    owner_id: row.owner_id ?? null,
    last_checked_date: row.last_checked_date ?? null,
    checked_by: row.checked_by ?? null,
  };
}

/** Fetches the current owner's insurance verification record (at most one). */
export async function fetchInsuranceVerification(): Promise<InsuranceVerification | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('insurance_verification')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return verificationFromRow(data as InsuranceVerificationRow | null);
}

/** Creates or updates the insurance verification record for the given owner. */
export async function upsertInsuranceVerification(
  ownerId: string,
  payload: { last_checked_date: string; checked_by: string }
): Promise<InsuranceVerification> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = {
    owner_id: ownerId,
    last_checked_date: payload.last_checked_date,
    checked_by: payload.checked_by || null,
  };
  const { data, error } = await supabase
    .from('insurance_verification')
    .upsert(row, { onConflict: 'owner_id' })
    .select('*')
    .single();
  if (error) throw error;
  return verificationFromRow(data as InsuranceVerificationRow)!;
}

// --- Team members (for Users page) ---

function teamMemberFromRow(r: {
  owner_id: string;
  email: string;
  member_id: string | null;
  created_at: string;
  allowed_pages?: unknown;
}): TeamMember {
  return {
    owner_id: r.owner_id,
    email: r.email,
    member_id: r.member_id,
    created_at: r.created_at,
    allowed_pages: r.allowed_pages == null ? null : normalizeAllowedPages(r.allowed_pages),
  };
}

export async function fetchTeamMembers(ownerId: string): Promise<TeamMember[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => teamMemberFromRow(r));
}

/** Current user's team membership row (for tab permissions). */
export async function fetchMyTeamMembership(
  userId: string
): Promise<{ owner_id: string; allowed_pages: PageId[] | null } | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('team_members')
    .select('owner_id, allowed_pages')
    .eq('member_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    owner_id: data.owner_id,
    allowed_pages:
      data.allowed_pages == null ? null : normalizeAllowedPages(data.allowed_pages),
  };
}

export async function addTeamMember(ownerId: string, email: string): Promise<TeamMember> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      owner_id: ownerId,
      email: email.trim().toLowerCase(),
      allowed_pages: DEFAULT_MEMBER_ALLOWED_PAGES,
    })
    .select('*')
    .single();
  if (error) throw error;
  return teamMemberFromRow(data);
}

/** Owner updates which tabs a team member may access. */
export async function updateTeamMemberAllowedPages(
  ownerId: string,
  email: string,
  allowedPages: PageId[]
): Promise<TeamMember> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('team_members')
    .update({ allowed_pages: allowedPages })
    .eq('owner_id', ownerId)
    .eq('email', email.trim().toLowerCase())
    .select('*')
    .single();
  if (error) throw error;
  return teamMemberFromRow(data);
}

export async function removeTeamMember(ownerId: string, email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('owner_id', ownerId)
    .eq('email', email);
  if (error) throw error;
}

// --- AAA Payments ---

function isAaaPayee(value: string): value is AaaPayee {
  return (AAA_PAYEES as readonly string[]).includes(value);
}

function aaaPaymentFromRow(row: AaaPaymentRow | null): AaaPayment | null {
  if (!row) return null;
  const payee = isAaaPayee(row.payee) ? row.payee : 'AAA Lease';
  const paymentDate =
    row.payment_date ?? (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  return {
    id: row.id,
    owner_id: row.owner_id ?? undefined,
    client: row.client,
    payee,
    amount: Number(row.amount),
    paymentDate,
    createdAt: row.created_at,
  };
}

export async function fetchAaaPayments(): Promise<AaaPayment[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('aaa_payments')
    .select('*')
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as AaaPaymentRow[] || []).map((row) => aaaPaymentFromRow(row)!);
}

export async function insertAaaPayment(
  payload: Omit<AaaPayment, 'id' | 'createdAt'>,
  ownerId?: string | null
): Promise<AaaPayment> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = {
    owner_id: ownerId ?? null,
    client: payload.client,
    payee: payload.payee,
    amount: payload.amount,
    payment_date: payload.paymentDate,
  };
  const { data, error } = await supabase.from('aaa_payments').insert(row).select('*').single();
  if (error) throw error;
  return aaaPaymentFromRow(data as AaaPaymentRow)!;
}

export async function updateAaaPayment(id: number, payment: AaaPayment): Promise<AaaPayment> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const row = {
    owner_id: payment.owner_id ?? null,
    client: payment.client,
    payee: payment.payee,
    amount: payment.amount,
    payment_date: payment.paymentDate,
  };
  const { data, error } = await supabase.from('aaa_payments').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return aaaPaymentFromRow(data as AaaPaymentRow)!;
}

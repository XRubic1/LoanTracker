import type { Loan, Reserve, LoanRow, ReserveRow, TeamMember, LoanProviderType } from '@/types';
import { getSupabase } from './supabase';

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

// --- Team members (for Users page) ---

export async function fetchTeamMembers(ownerId: string): Promise<TeamMember[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { owner_id: string; email: string; member_id: string | null; created_at: string }) => ({
    owner_id: r.owner_id,
    email: r.email,
    member_id: r.member_id,
    created_at: r.created_at,
  }));
}

export async function addTeamMember(ownerId: string, email: string): Promise<TeamMember> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('team_members')
    .insert({ owner_id: ownerId, email: email.trim().toLowerCase() })
    .select('*')
    .single();
  if (error) throw error;
  return {
    owner_id: data.owner_id,
    email: data.email,
    member_id: data.member_id,
    created_at: data.created_at,
  };
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

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

export type PageId = 'overview' | 'loans' | 'reserves' | 'closed' | 'users';

/** Team member (owner's invited user) */
export interface TeamMember {
  owner_id: string;
  email: string;
  member_id: string | null;
  created_at: string;
}

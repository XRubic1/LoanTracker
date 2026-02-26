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
  note: string;
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
  note: string | null;
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
}

export type PageId = 'overview' | 'loans' | 'reserves' | 'closed' | 'users';

/** Team member (owner's invited user) */
export interface TeamMember {
  owner_id: string;
  email: string;
  member_id: string | null;
  created_at: string;
}

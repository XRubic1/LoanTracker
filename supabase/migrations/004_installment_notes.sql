-- Per-installment notes for loans and reserves. Run after 003.

-- Loans: one note per installment (same order as payment_dates)
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS payment_notes JSONB NOT NULL DEFAULT '[]';

-- Reserves: one note per deduction (same order as deduction_dates)
ALTER TABLE public.reserves
  ADD COLUMN IF NOT EXISTS deduction_notes JSONB NOT NULL DEFAULT '[]';

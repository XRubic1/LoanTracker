-- Per-installment deduction amounts (supports uneven schedules from imports).
-- When empty/null, UI falls back to loans.installment for every row.

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS payment_amounts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.loans.payment_amounts IS
  'Per-installment amounts (same order as payment_dates). Empty = use flat installment.';

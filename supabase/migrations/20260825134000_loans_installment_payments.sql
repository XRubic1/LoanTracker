-- Per-installment payment history (partials + closing payments).
-- Shape: jsonb array of arrays — installment_payments[i] = [{ amount, date, note }, ...]
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS installment_payments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.loans.installment_payments IS
  'Payments posted per installment index: [[{amount, date, note}, ...], ...]';

-- Track money already posted toward the current open installment (partial payments).
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS partial_paid_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.loans.partial_paid_amount IS
  'Amount already paid toward the current open installment (index = paid_count). Reset to 0 when that installment closes.';

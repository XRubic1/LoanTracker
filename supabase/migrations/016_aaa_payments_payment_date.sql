-- Add payment_date to aaa_payments (for DBs created before 015 included this column).

ALTER TABLE public.aaa_payments
  ADD COLUMN IF NOT EXISTS payment_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_aaa_payments_payment_date ON public.aaa_payments (payment_date DESC);

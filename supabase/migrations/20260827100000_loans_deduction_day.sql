-- Weekday a loan is normally deducted (0 = Sunday ... 6 = Saturday). Informational; shown on the dashboard.
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS deduction_day smallint
  CHECK (deduction_day IS NULL OR deduction_day BETWEEN 0 AND 6);

COMMENT ON COLUMN public.loans.deduction_day IS
  'Day of week this loan is deducted: 0 = Sunday ... 6 = Saturday. NULL = not set.';

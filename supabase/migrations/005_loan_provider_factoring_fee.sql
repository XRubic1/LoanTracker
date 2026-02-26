-- Add provider (TruFunding / Other) and factoring fee to loans
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'TruFunding',
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS factoring_fee NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.loans.provider_type IS 'TruFunding or Other';
COMMENT ON COLUMN public.loans.provider_name IS 'Custom provider name when provider_type = Other';
COMMENT ON COLUMN public.loans.factoring_fee IS 'Fee added to total; effective total = total + factoring_fee, installment = effective_total / total_installments';

-- New client onboarding: start date, review period (default 30 days), reviewed flag.

ALTER TABLE public.client_insurance
  ADD COLUMN IF NOT EXISTS is_new_client BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS started_date DATE,
  ADD COLUMN IF NOT EXISTS new_client_reviewed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_days INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.client_insurance.is_new_client IS 'Client is in new-client verification window.';
COMMENT ON COLUMN public.client_insurance.started_date IS 'Date client started working with us.';
COMMENT ON COLUMN public.client_insurance.new_client_reviewed IS 'User marked new-client review complete.';
COMMENT ON COLUMN public.client_insurance.verification_days IS 'Days after started_date until review is due (extendable).';

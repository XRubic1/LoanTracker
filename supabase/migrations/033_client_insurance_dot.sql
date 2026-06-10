-- USDOT number on client insurance records (alongside MC).

ALTER TABLE public.client_insurance
  ADD COLUMN IF NOT EXISTS dot TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.client_insurance.dot IS 'USDOT number for the client carrier.';

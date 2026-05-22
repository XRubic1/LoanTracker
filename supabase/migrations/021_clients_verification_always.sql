-- Option to mark new-client verification as always complete (no review due).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS verification_always BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.verification_always IS 'When true, new-client verification is always satisfied (type "always" for verification period).';

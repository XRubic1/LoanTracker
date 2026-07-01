-- Client registry: optional contact email per client.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.clients.email IS 'Client contact email address.';

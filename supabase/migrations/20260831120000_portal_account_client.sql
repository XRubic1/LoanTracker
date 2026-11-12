-- Portal logins now belong to a client from the Clients tab.

-- A client saved twice before this change has two logins: keep the newest one.
DELETE FROM public.portal_upload_accounts a
USING public.portal_upload_accounts b
WHERE a.owner_id = b.owner_id
  AND lower(trim(a.label)) = lower(trim(b.label))
  AND a.id < b.id;

ALTER TABLE public.portal_upload_accounts
  ADD COLUMN IF NOT EXISTS client_id BIGINT REFERENCES public.clients (id) ON DELETE CASCADE;

-- Link logins that were already saved by matching the client name.
UPDATE public.portal_upload_accounts a
SET client_id = c.id
FROM public.clients c
WHERE a.client_id IS NULL
  AND lower(trim(c.name)) = lower(trim(a.label))
  AND (c.owner_id = a.owner_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.portal_upload_accounts b WHERE b.client_id = c.id AND b.owner_id = a.owner_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_upload_accounts_client
  ON public.portal_upload_accounts (owner_id, client_id)
  WHERE client_id IS NOT NULL;

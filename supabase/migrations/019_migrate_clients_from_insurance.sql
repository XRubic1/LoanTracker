-- Migrate new-client fields from client_insurance into clients; drop insurance columns.

INSERT INTO public.clients (
  owner_id,
  name,
  is_new_client,
  started_date,
  new_client_reviewed,
  verification_days
)
SELECT
  ci.owner_id,
  trim(ci.client) AS name,
  COALESCE(ci.is_new_client, false),
  ci.started_date,
  COALESCE(ci.new_client_reviewed, false),
  COALESCE(ci.verification_days, 30)
FROM public.client_insurance ci
WHERE trim(ci.client) <> ''
ON CONFLICT (owner_id, name) DO UPDATE SET
  is_new_client = EXCLUDED.is_new_client OR public.clients.is_new_client,
  started_date = COALESCE(EXCLUDED.started_date, public.clients.started_date),
  new_client_reviewed = CASE
    WHEN EXCLUDED.is_new_client THEN EXCLUDED.new_client_reviewed
    ELSE public.clients.new_client_reviewed
  END,
  verification_days = GREATEST(
    COALESCE(public.clients.verification_days, 30),
    COALESCE(EXCLUDED.verification_days, 30)
  ),
  updated_at = NOW();

ALTER TABLE public.client_insurance
  DROP COLUMN IF EXISTS is_new_client,
  DROP COLUMN IF EXISTS started_date,
  DROP COLUMN IF EXISTS new_client_reviewed,
  DROP COLUMN IF EXISTS verification_days;

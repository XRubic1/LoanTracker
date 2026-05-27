-- Worksheet: read-only global client + insurance lookup across all provisioned teams.
-- Clients tab remains scoped via clients_select (linked groups only).

CREATE OR REPLACE FUNCTION public.provisioned_owner_ids()
RETURNS SETOF UUID AS $$
  SELECT owner_id
  FROM public.companies
  WHERE owner_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.provisioned_owner_ids() TO authenticated;

-- All registry clients for worksheet autocomplete, warnings, and expenses.
CREATE OR REPLACE FUNCTION public.fetch_worksheet_client_registry()
RETURNS SETOF public.clients
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.*
  FROM public.clients c
  WHERE auth.role() = 'authenticated'
    AND (
      c.owner_id IN (SELECT public.provisioned_owner_ids())
      OR c.owner_id IS NULL
    )
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_worksheet_client_registry() TO authenticated;

-- Insurance rows for worksheet cancellation / verification alerts (by client name).
CREATE OR REPLACE FUNCTION public.fetch_worksheet_insurance_lookup()
RETURNS SETOF public.client_insurance
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ci.*
  FROM public.client_insurance ci
  WHERE auth.role() = 'authenticated'
    AND (
      ci.owner_id IN (SELECT public.provisioned_owner_ids())
      OR ci.owner_id IS NULL
    )
  ORDER BY ci.client;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_worksheet_insurance_lookup() TO authenticated;

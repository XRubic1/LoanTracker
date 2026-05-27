-- Worksheet registry: all clients for any logged-in user (read-only via RPC).
-- Replaces provisioned_owner_ids filter that could miss team clients.

CREATE OR REPLACE FUNCTION public.fetch_worksheet_client_registry()
RETURNS SETOF public.clients
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.*
  FROM public.clients c
  WHERE auth.uid() IS NOT NULL
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_worksheet_client_registry() TO authenticated;

CREATE OR REPLACE FUNCTION public.search_worksheet_clients(
  p_query text DEFAULT '',
  p_limit int DEFAULT 20
)
RETURNS SETOF public.clients
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.*
  FROM public.clients c
  WHERE auth.uid() IS NOT NULL
    AND (
      trim(coalesce(p_query, '')) = ''
      OR c.name ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY
    CASE WHEN c.name ILIKE trim(p_query) THEN 0
         WHEN c.name ILIKE trim(p_query) || '%' THEN 1
         ELSE 2
    END,
    c.name
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

GRANT EXECUTE ON FUNCTION public.search_worksheet_clients(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fetch_worksheet_insurance_lookup()
RETURNS SETOF public.client_insurance
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ci.*
  FROM public.client_insurance ci
  WHERE auth.uid() IS NOT NULL
  ORDER BY ci.client;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_worksheet_insurance_lookup() TO authenticated;

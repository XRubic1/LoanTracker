-- Only share data between teams with an active client_share_group_id link.
-- Removes stale owner_company_group_members rows that kept unlinked teams visible.

-- Drop orphaned memberships (company unlinked but row left in group).
DELETE FROM public.owner_company_group_members m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.owner_id = m.owner_id
    AND c.client_share_group_id = m.group_id
);

-- Clear group id on companies that no longer have a matching membership row.
UPDATE public.companies c
SET client_share_group_id = NULL,
    updated_at = NOW()
WHERE c.client_share_group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.owner_company_group_members m
    WHERE m.group_id = c.client_share_group_id
      AND m.owner_id = c.owner_id
  );

CREATE OR REPLACE FUNCTION public.linked_owner_ids()
RETURNS SETOF UUID AS $$
  WITH base AS (
    SELECT public.effective_owner_id() AS oid
  ),
  my_groups AS (
    SELECT DISTINCT c.client_share_group_id AS group_id
    FROM public.companies c
    WHERE c.owner_id = (SELECT oid FROM base)
      AND c.client_share_group_id IS NOT NULL
  )
  SELECT oid FROM base
  UNION
  SELECT DISTINCT c.owner_id
  FROM public.companies c
  INNER JOIN my_groups mg ON c.client_share_group_id = mg.group_id
  INNER JOIN public.owner_company_group_members m
    ON m.group_id = mg.group_id
   AND m.owner_id = c.owner_id
  WHERE c.owner_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Re-assert clients visibility (linked teams only).
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id IS NULL
  );

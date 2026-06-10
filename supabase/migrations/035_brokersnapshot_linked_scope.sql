-- BrokerSnapshot sync: only client_insurance for owners in active client-share link groups.

CREATE OR REPLACE FUNCTION public.effective_owner_id_for(p_user_id uuid)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tm.owner_id FROM public.team_members tm WHERE tm.member_id = p_user_id LIMIT 1),
    p_user_id
  );
$$;

-- Mirror linked_owner_ids() for a specific effective owner (no auth context).
CREATE OR REPLACE FUNCTION public.linked_owner_ids_for(p_effective_owner_id uuid)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_groups AS (
    SELECT DISTINCT c.client_share_group_id AS group_id
    FROM public.companies c
    WHERE c.owner_id = p_effective_owner_id
      AND c.client_share_group_id IS NOT NULL
  )
  SELECT p_effective_owner_id
  UNION
  SELECT DISTINCT c.owner_id
  FROM public.companies c
  INNER JOIN my_groups mg ON c.client_share_group_id = mg.group_id
  INNER JOIN public.owner_company_group_members m
    ON m.group_id = mg.group_id
   AND m.owner_id = c.owner_id
  WHERE c.owner_id IS NOT NULL;
$$;

-- Owners whose provisioned company is in an active client-share link group.
CREATE OR REPLACE FUNCTION public.all_linked_pool_owner_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT c.owner_id
  FROM public.companies c
  INNER JOIN public.owner_company_group_members m
    ON m.group_id = c.client_share_group_id
   AND m.owner_id = c.owner_id
  WHERE c.client_share_group_id IS NOT NULL
    AND c.owner_id IS NOT NULL;
$$;

-- Owner ids to include in a BrokerSnapshot sync run.
-- Manual: invoking user's linked group only. Cron: all linked pools.
CREATE OR REPLACE FUNCTION public.brokersnapshot_sync_owner_ids(p_triggering_user_id uuid DEFAULT NULL)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_triggering_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT lo.owner_id
    FROM (
      SELECT public.linked_owner_ids_for(public.effective_owner_id_for(p_triggering_user_id)) AS owner_id
    ) lo
    WHERE lo.owner_id IN (SELECT public.all_linked_pool_owner_ids());
    RETURN;
  END IF;

  RETURN QUERY SELECT public.all_linked_pool_owner_ids();
END;
$$;

COMMENT ON FUNCTION public.brokersnapshot_sync_owner_ids IS
  'Owner IDs whose client_insurance records BrokerSnapshot sync should check (linked accounts only).';

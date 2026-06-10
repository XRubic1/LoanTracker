-- BrokerSnapshot sync: owner account only — not linked teams in client-share groups.

CREATE OR REPLACE FUNCTION public.brokersnapshot_sync_owner_ids(p_triggering_user_id uuid DEFAULT NULL)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_triggering_user_id IS NOT NULL THEN
    RETURN QUERY SELECT public.effective_owner_id_for(p_triggering_user_id);
    RETURN;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.brokersnapshot_sync_owner_ids IS
  'Single owner_id for BrokerSnapshot sync (your account only — excludes linked teams).';

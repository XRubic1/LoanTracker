-- Clear BrokerSnapshot monitoring data for one owner team (manual reset from API tab).

CREATE OR REPLACE FUNCTION public.clear_brokersnapshot_monitoring_data(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective uuid;
  v_suggestions int;
  v_logs int;
  v_runs int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_effective := public.effective_owner_id_for(auth.uid());
  IF p_owner_id IS DISTINCT FROM v_effective
     AND p_owner_id IS DISTINCT FROM auth.uid() THEN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'team_members'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.member_id = auth.uid() AND tm.owner_id = p_owner_id
    ) THEN
      RAISE EXCEPTION 'Not authorized to clear data for this team';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized to clear data for this team';
  END IF;
  END IF;

  DELETE FROM public.brokersnapshot_cancellation_suggestions
  WHERE owner_id = p_owner_id;
  GET DIAGNOSTICS v_suggestions = ROW_COUNT;

  DELETE FROM public.brokersnapshot_api_logs
  WHERE owner_id = p_owner_id;
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  DELETE FROM public.brokersnapshot_sync_runs r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brokersnapshot_api_logs l WHERE l.sync_run_id = r.id
  );
  GET DIAGNOSTICS v_runs = ROW_COUNT;

  UPDATE public.client_insurance
  SET brokersnapshot_last_checked_at = NULL
  WHERE owner_id = p_owner_id;

  RETURN jsonb_build_object(
    'suggestions_deleted', v_suggestions,
    'logs_deleted', v_logs,
    'sync_runs_deleted', v_runs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_brokersnapshot_monitoring_data(uuid) TO authenticated;

COMMENT ON FUNCTION public.clear_brokersnapshot_monitoring_data IS
  'Remove BrokerSnapshot logs, suggestions, and last-checked timestamps for one owner team.';

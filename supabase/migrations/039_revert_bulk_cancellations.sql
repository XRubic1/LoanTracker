-- Revert mistaken bulk BrokerSnapshot approvals (cancellation + same expiration date).

CREATE OR REPLACE FUNCTION public.revert_brokersnapshot_bulk_cancellations(
  p_owner_id uuid,
  p_cancellation_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective uuid;
  v_reverted int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_cancellation_date IS NULL THEN
    RAISE EXCEPTION 'Cancellation date is required';
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
        RAISE EXCEPTION 'Not authorized to revert data for this team';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not authorized to revert data for this team';
    END IF;
  END IF;

  UPDATE public.client_insurance ci
  SET
    status = 'OK',
    expiration_date = NULL,
    updated_at = NOW()
  WHERE ci.owner_id = p_owner_id
    AND ci.expiration_date = p_cancellation_date
    AND lower(trim(ci.status)) LIKE '%cancellation%';

  GET DIAGNOSTICS v_reverted = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brokersnapshot_cancellation_suggestions'
  ) THEN
    UPDATE public.brokersnapshot_cancellation_suggestions s
    SET review_status = 'superseded'
    WHERE s.owner_id = p_owner_id
      AND s.suggested_cancellation_date = p_cancellation_date
      AND s.review_status IN ('pending', 'approved');
  END IF;

  RETURN jsonb_build_object(
    'reverted_count', v_reverted,
    'cancellation_date', p_cancellation_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_brokersnapshot_bulk_cancellations(uuid, date) TO authenticated;

COMMENT ON FUNCTION public.revert_brokersnapshot_bulk_cancellations IS
  'Reset client_insurance rows wrongly set to cancellation on one date (bulk approve mistake).';

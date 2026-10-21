-- AAA Fuel can delete open AAA Mega Fuel payments. Closed payments (history) cannot be deleted.

CREATE OR REPLACE FUNCTION public.aaa_fuel_delete_due(p_due_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.aaa_dues
  WHERE id = p_due_id AND payee = 'AAA Mega Fuel' AND closed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already closed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_delete_due(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_delete_due(BIGINT) TO authenticated;

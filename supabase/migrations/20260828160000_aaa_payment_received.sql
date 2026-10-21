-- AAA Fuel marks closed AAA Mega Fuel payments as received (and can undo it).

ALTER TABLE public.aaa_payments
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

COMMENT ON COLUMN public.aaa_payments.received_at IS
  'When AAA Fuel marked this AAA Mega Fuel payment as received. NULL = not marked.';

CREATE OR REPLACE FUNCTION public.aaa_fuel_set_received(p_payment_id BIGINT, p_received BOOLEAN)
RETURNS public.aaa_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.aaa_payments;
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.aaa_payments
  SET received_at = CASE WHEN p_received THEN coalesce(received_at, now()) ELSE NULL END
  WHERE id = p_payment_id AND payee = 'AAA Mega Fuel'
  RETURNING * INTO p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_set_received(BIGINT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_set_received(BIGINT, BOOLEAN) TO authenticated;

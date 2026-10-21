-- AAA Fuel can mark a closed Mega Fuel payment as received, as not received, or clear the mark.
-- "Not received" is only allowed once 2 days have passed since the payment was deducted.

ALTER TABLE public.aaa_payments
  ADD COLUMN IF NOT EXISTS not_received_at TIMESTAMPTZ;

COMMENT ON COLUMN public.aaa_payments.not_received_at IS
  'When AAA Fuel marked this AAA Mega Fuel payment as NOT received. NULL = not marked. Mutually exclusive with received_at.';

DROP FUNCTION IF EXISTS public.aaa_fuel_set_received(BIGINT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.aaa_fuel_set_receipt(p_payment_id BIGINT, p_status TEXT)
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
  IF p_status IS NOT NULL AND p_status NOT IN ('received', 'not_received') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO p
  FROM public.aaa_payments
  WHERE id = p_payment_id AND payee = 'AAA Mega Fuel'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  -- Deducted today or yesterday: the money may still be on its way.
  -- (current_date + 1 keeps this server check from being stricter than the app across time zones.)
  IF p_status = 'not_received' AND p.payment_date + 2 > current_date + 1 THEN
    RAISE EXCEPTION 'Please allow 2 days after the deduction for the payment to arrive';
  END IF;

  UPDATE public.aaa_payments
  SET received_at = CASE WHEN p_status = 'received' THEN coalesce(received_at, now()) ELSE NULL END,
      not_received_at = CASE WHEN p_status = 'not_received' THEN coalesce(not_received_at, now()) ELSE NULL END
  WHERE id = p.id
  RETURNING * INTO p;

  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_set_receipt(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_set_receipt(BIGINT, TEXT) TO authenticated;

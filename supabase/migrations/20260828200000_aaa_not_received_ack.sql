-- The team that owns the client is alerted when AAA Fuel marks a payment as not received.
-- not_received_ack_at is set when someone on that team dismisses the alert; it is cleared again
-- whenever AAA Fuel (re)marks the payment, so a new "not received" always alerts again.

ALTER TABLE public.aaa_payments
  ADD COLUMN IF NOT EXISTS not_received_ack_at TIMESTAMPTZ;

COMMENT ON COLUMN public.aaa_payments.not_received_ack_at IS
  'When the owning team dismissed the "not received" alert. NULL = alert still showing.';

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
  SET received_at = CASE WHEN p_status = 'received' THEN coalesce(p.received_at, now()) ELSE NULL END,
      not_received_at = CASE WHEN p_status = 'not_received' THEN coalesce(p.not_received_at, now()) ELSE NULL END,
      -- A fresh "not received" alerts the team; marking it again while already flagged keeps their dismissal.
      not_received_ack_at = CASE
        WHEN p_status = 'not_received' AND p.not_received_at IS NOT NULL THEN p.not_received_ack_at
        ELSE NULL
      END
  WHERE id = p.id
  RETURNING * INTO p;

  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_set_receipt(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_set_receipt(BIGINT, TEXT) TO authenticated;

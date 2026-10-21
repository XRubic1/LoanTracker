-- AAA Fuel can mark a whole invoice (weekly AAA payment) as received / not received / cleared in one go.
-- It applies to every payment (deduction) posted against that invoice so far.
-- "Not received" keeps the 2-day rule: every payment on the invoice must be at least 2 days old.

CREATE OR REPLACE FUNCTION public.aaa_fuel_set_invoice_receipt(p_due_id BIGINT, p_status TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('received', 'not_received') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF p_status = 'not_received' AND EXISTS (
    SELECT 1 FROM public.aaa_payments
    WHERE due_id = p_due_id AND payee = 'AAA Mega Fuel' AND payment_date + 2 > current_date + 1
  ) THEN
    RAISE EXCEPTION 'Please allow 2 days after the deduction for the payment to arrive';
  END IF;

  UPDATE public.aaa_payments
  SET received_at = CASE WHEN p_status = 'received' THEN coalesce(received_at, now()) ELSE NULL END,
      not_received_at = CASE WHEN p_status = 'not_received' THEN coalesce(not_received_at, now()) ELSE NULL END,
      not_received_ack_at = CASE
        WHEN p_status = 'not_received' AND not_received_at IS NOT NULL THEN not_received_ack_at
        ELSE NULL
      END
  WHERE due_id = p_due_id AND payee = 'AAA Mega Fuel';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No payments have been posted on this invoice yet';
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_set_invoice_receipt(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_set_invoice_receipt(BIGINT, TEXT) TO authenticated;

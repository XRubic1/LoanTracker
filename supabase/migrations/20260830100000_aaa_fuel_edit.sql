-- AAA Fuel can correct an invoice total and the amount / day of a posted payment.
-- The invoice (aaa_dues) and its payment records stay in step; the invoice closes or re-opens
-- depending on whether the payments now cover the total.

CREATE OR REPLACE FUNCTION public.aaa_fuel_edit_due_amount(p_due_id BIGINT, p_amount NUMERIC)
RETURNS public.aaa_dues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.aaa_dues;
  v_amount NUMERIC := round(coalesce(p_amount, 0), 2);
  v_paid NUMERIC;
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than 0';
  END IF;

  SELECT * INTO d FROM public.aaa_dues WHERE id = p_due_id AND payee = 'AAA Mega Fuel' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT coalesce(sum((e ->> 'amount')::NUMERIC), 0) INTO v_paid FROM jsonb_array_elements(d.deductions) e;
  IF v_amount < v_paid - 0.001 THEN
    RAISE EXCEPTION 'The invoice cannot be less than the % already deducted', to_char(v_paid, 'FM$999,999,990.00');
  END IF;

  UPDATE public.aaa_payments SET due_amount = v_amount WHERE due_id = d.id;

  UPDATE public.aaa_dues
  SET amount = v_amount,
      closed_at = CASE
        WHEN v_paid >= v_amount - 0.001 AND v_paid > 0 THEN coalesce(d.closed_at, now())
        ELSE NULL
      END
  WHERE id = d.id
  RETURNING * INTO d;

  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.aaa_fuel_edit_payment(p_payment_id BIGINT, p_amount NUMERIC, p_date DATE)
RETURNS public.aaa_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.aaa_payments;
  d public.aaa_dues;
  v_amount NUMERIC := round(coalesce(p_amount, 0), 2);
  v_date DATE := coalesce(p_date, current_date);
  v_old JSONB;
  v_skip INT;
  v_new JSONB;
  v_paid NUMERIC;
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than 0';
  END IF;

  SELECT * INTO p FROM public.aaa_payments WHERE id = p_payment_id AND payee = 'AAA Mega Fuel' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  v_old := p.deductions -> 0;

  IF p.due_id IS NOT NULL THEN
    SELECT * INTO d FROM public.aaa_dues WHERE id = p.due_id FOR UPDATE;
    IF FOUND THEN
      v_skip := NULL;
      IF v_old IS NOT NULL THEN
        SELECT ord INTO v_skip
        FROM jsonb_array_elements(d.deductions) WITH ORDINALITY AS t(e, ord)
        WHERE (e ->> 'amount')::NUMERIC = (v_old ->> 'amount')::NUMERIC
          AND (e ->> 'date') = (v_old ->> 'date')
        ORDER BY ord
        LIMIT 1;
      END IF;

      SELECT coalesce(jsonb_agg(
               CASE WHEN ord = v_skip
                    THEN e || jsonb_build_object('amount', v_amount, 'date', v_date)
                    ELSE e END
               ORDER BY ord), '[]'::JSONB)
      INTO v_new
      FROM jsonb_array_elements(d.deductions) WITH ORDINALITY AS t(e, ord);

      SELECT coalesce(sum((e ->> 'amount')::NUMERIC), 0) INTO v_paid FROM jsonb_array_elements(v_new) e;
      IF v_paid > d.amount + 0.001 THEN
        RAISE EXCEPTION 'That is more than the invoice total of %', to_char(d.amount, 'FM$999,999,990.00');
      END IF;

      UPDATE public.aaa_dues
      SET deductions = v_new,
          closed_at = CASE
            WHEN v_paid >= d.amount - 0.001 THEN coalesce(d.closed_at, now())
            ELSE NULL
          END
      WHERE id = d.id;
    END IF;
  END IF;

  UPDATE public.aaa_payments
  SET amount = v_amount,
      payment_date = v_date,
      deductions = CASE
        WHEN v_old IS NULL THEN deductions
        ELSE jsonb_build_array(v_old || jsonb_build_object('amount', v_amount, 'date', v_date))
      END
  WHERE id = p.id
  RETURNING * INTO p;

  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_edit_due_amount(BIGINT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_edit_due_amount(BIGINT, NUMERIC) TO authenticated;
REVOKE ALL ON FUNCTION public.aaa_fuel_edit_payment(BIGINT, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_edit_payment(BIGINT, NUMERIC, DATE) TO authenticated;

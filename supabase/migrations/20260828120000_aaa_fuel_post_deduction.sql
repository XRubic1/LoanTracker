-- AAA Fuel can post deductions (partial or full) against open AAA Mega Fuel payments.
-- Same rules as the team side: never more than what is left; when the total is reached the
-- payment closes and a normal aaa_payments record (with the per-day deductions) is created.

CREATE OR REPLACE FUNCTION public.aaa_fuel_post_deduction(
  p_due_id BIGINT,
  p_amount NUMERIC,
  p_date DATE,
  p_note TEXT DEFAULT NULL
)
RETURNS public.aaa_dues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.aaa_dues;
  v_paid NUMERIC;
  v_amount NUMERIC := round(coalesce(p_amount, 0), 2);
  v_new JSONB;
  v_closes BOOLEAN;
  v_latest DATE;
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than 0';
  END IF;

  SELECT * INTO d
  FROM public.aaa_dues
  WHERE id = p_due_id AND payee = 'AAA Mega Fuel' AND closed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already closed';
  END IF;

  SELECT coalesce(sum((e ->> 'amount')::NUMERIC), 0) INTO v_paid
  FROM jsonb_array_elements(d.deductions) e;

  IF v_paid + v_amount > d.amount + 0.001 THEN
    RAISE EXCEPTION 'That is more than the % still owed', to_char(d.amount - v_paid, 'FM$999,999,990.00');
  END IF;

  v_new := d.deductions || jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object(
      'amount', v_amount,
      'date', coalesce(p_date, current_date),
      'note', nullif(trim(coalesce(p_note, '')), ''),
      'by', 'fuel'
    ))
  );
  v_closes := v_paid + v_amount >= d.amount - 0.001;

  IF v_closes THEN
    SELECT max((e ->> 'date')::DATE) INTO v_latest FROM jsonb_array_elements(v_new) e;
    INSERT INTO public.aaa_payments (owner_id, client, payee, amount, payment_date, deductions, week_start)
    VALUES (d.owner_id, d.client, d.payee, d.amount, v_latest, v_new, d.week_start);
  END IF;

  UPDATE public.aaa_dues
  SET deductions = v_new,
      closed_at = CASE WHEN v_closes THEN now() ELSE NULL END
  WHERE id = d.id
  RETURNING * INTO d;

  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_post_deduction(BIGINT, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_post_deduction(BIGINT, NUMERIC, DATE, TEXT) TO authenticated;

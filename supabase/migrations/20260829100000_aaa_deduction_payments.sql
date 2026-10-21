-- Every deduction posted against a weekly AAA payment becomes its own AAA payment record
-- (partial or full), so each one can be marked received / not received on its own.
-- A weekly payment that is fully deducted no longer creates a separate combined record.

ALTER TABLE public.aaa_payments
  ADD COLUMN IF NOT EXISTS due_id BIGINT REFERENCES public.aaa_dues (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_amount NUMERIC(14, 2);

COMMENT ON COLUMN public.aaa_payments.due_id IS 'Weekly AAA payment (aaa_dues) this deduction was posted against.';
COMMENT ON COLUMN public.aaa_payments.due_amount IS 'Total owed on that weekly payment when this deduction was posted.';

CREATE INDEX IF NOT EXISTS idx_aaa_payments_due_id ON public.aaa_payments (due_id);

-- Deductions that were already posted on weekly payments that are still open become payment records too.
INSERT INTO public.aaa_payments (owner_id, client, payee, amount, payment_date, deductions, week_start, due_id, due_amount)
SELECT d.owner_id, d.client, d.payee, (e ->> 'amount')::NUMERIC, (e ->> 'date')::DATE,
       jsonb_build_array(e), d.week_start, d.id, d.amount
FROM public.aaa_dues d
CROSS JOIN LATERAL jsonb_array_elements(d.deductions) e
WHERE d.closed_at IS NULL
  AND jsonb_array_length(d.deductions) > 0
  AND NOT EXISTS (SELECT 1 FROM public.aaa_payments p WHERE p.due_id = d.id);

-- AAA Fuel posting a deduction: one payment record per deduction.
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
  v_date DATE := coalesce(p_date, current_date);
  v_ded JSONB;
  v_closes BOOLEAN;
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

  v_ded := jsonb_strip_nulls(jsonb_build_object(
    'amount', v_amount,
    'date', v_date,
    'note', nullif(trim(coalesce(p_note, '')), ''),
    'by', 'fuel'
  ));
  v_closes := v_paid + v_amount >= d.amount - 0.001;

  INSERT INTO public.aaa_payments (owner_id, client, payee, amount, payment_date, deductions, week_start, due_id, due_amount)
  VALUES (d.owner_id, d.client, d.payee, v_amount, v_date, jsonb_build_array(v_ded), d.week_start, d.id, d.amount);

  UPDATE public.aaa_dues
  SET deductions = d.deductions || jsonb_build_array(v_ded),
      closed_at = CASE WHEN v_closes THEN now() ELSE NULL END
  WHERE id = d.id
  RETURNING * INTO d;

  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_post_deduction(BIGINT, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_post_deduction(BIGINT, NUMERIC, DATE, TEXT) TO authenticated;

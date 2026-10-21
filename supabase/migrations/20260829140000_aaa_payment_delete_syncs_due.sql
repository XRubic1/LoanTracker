-- Deleting a deduction's payment record also removes that deduction from its weekly AAA payment
-- (and re-opens the weekly payment if it was closed), so the invoice and its payment list never disagree.

CREATE OR REPLACE FUNCTION public.aaa_payment_deleted_sync_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.aaa_dues;
  v_new JSONB;
  v_paid NUMERIC;
  v_match JSONB := OLD.deductions -> 0;
  v_skip INT;
BEGIN
  IF OLD.due_id IS NULL OR v_match IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT * INTO d FROM public.aaa_dues WHERE id = OLD.due_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  -- Position of the first deduction with the same amount and day.
  SELECT ord INTO v_skip
  FROM jsonb_array_elements(d.deductions) WITH ORDINALITY AS t(e, ord)
  WHERE (e ->> 'amount')::NUMERIC = (v_match ->> 'amount')::NUMERIC
    AND (e ->> 'date') = (v_match ->> 'date')
  ORDER BY ord
  LIMIT 1;
  IF v_skip IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::JSONB) INTO v_new
  FROM jsonb_array_elements(d.deductions) WITH ORDINALITY AS t(e, ord)
  WHERE ord <> v_skip;

  SELECT coalesce(sum((e ->> 'amount')::NUMERIC), 0) INTO v_paid FROM jsonb_array_elements(v_new) e;

  UPDATE public.aaa_dues
  SET deductions = v_new,
      closed_at = CASE WHEN v_paid >= d.amount - 0.001 THEN d.closed_at ELSE NULL END
  WHERE id = d.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS aaa_payment_deleted_sync_due ON public.aaa_payments;
CREATE TRIGGER aaa_payment_deleted_sync_due
  AFTER DELETE ON public.aaa_payments
  FOR EACH ROW EXECUTE FUNCTION public.aaa_payment_deleted_sync_due();

-- One-time fix for invoices where a payment record was already deleted before this trigger existed:
-- rebuild the invoice's deductions from the payment records that still exist.
WITH linked AS (
  SELECT p.due_id,
         jsonb_agg(p.deductions -> 0 ORDER BY p.payment_date, p.id) AS ded,
         sum(p.amount) AS paid
  FROM public.aaa_payments p
  WHERE p.due_id IS NOT NULL AND p.deductions -> 0 IS NOT NULL
  GROUP BY p.due_id
)
UPDATE public.aaa_dues d
SET deductions = l.ded,
    closed_at = CASE WHEN l.paid >= d.amount - 0.001 THEN d.closed_at ELSE NULL END
FROM linked l
WHERE d.id = l.due_id
  AND (SELECT coalesce(sum((e ->> 'amount')::NUMERIC), 0) FROM jsonb_array_elements(d.deductions) e) <> l.paid;

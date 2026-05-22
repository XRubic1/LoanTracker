-- Client expenses: Wire or ACH (was numeric).

ALTER TABLE public.clients
  ALTER COLUMN expenses TYPE TEXT USING (
    CASE
      WHEN expenses IS NULL THEN NULL
      WHEN expenses::text IN ('Wire', 'ACH') THEN expenses::text
      ELSE NULL
    END
  );

COMMENT ON COLUMN public.clients.expenses IS 'Payment method for client expenses: Wire or ACH.';

-- Per-client expense amounts for ACH and Wire. `expenses` keeps the chosen method.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ach_expense numeric,
  ADD COLUMN IF NOT EXISTS wire_expense numeric;

COMMENT ON COLUMN public.clients.ach_expense IS 'Expense amount charged when this client is paid by ACH.';
COMMENT ON COLUMN public.clients.wire_expense IS 'Expense amount charged when this client is paid by Wire.';

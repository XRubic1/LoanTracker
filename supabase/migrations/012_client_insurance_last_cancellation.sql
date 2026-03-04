-- Audit: when was the last time this client had a cancellation (visible in view popup).
-- Set when status is cancellation with a date; kept when status changes back (e.g. to OK).

ALTER TABLE public.client_insurance
  ADD COLUMN IF NOT EXISTS last_cancellation_date DATE;

COMMENT ON COLUMN public.client_insurance.last_cancellation_date IS 'Last date this client was in cancellation status (audit; not cleared when status changes).';

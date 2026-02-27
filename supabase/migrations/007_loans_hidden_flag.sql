-- Add a hidden flag to loans so inactive/abandoned loans can be hidden from the dashboard
-- Safe when run before 001: does nothing if public.loans does not exist yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loans'
  ) THEN
    ALTER TABLE public.loans
      ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

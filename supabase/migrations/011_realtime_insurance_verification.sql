-- Enable Realtime for insurance_verification (run after 010_insurance_verification.sql).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insurance_verification') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.insurance_verification;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Enable Realtime for client_insurance (run after 008_client_insurance.sql).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_insurance') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.client_insurance;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

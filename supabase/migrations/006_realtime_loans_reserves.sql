-- Enable Realtime for loans and reserves so all clients get live updates without refresh.
-- Only runs if the tables exist (run after 001_initial.sql). Safe if tables already in publication.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loans') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already in publication
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reserves') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reserves;
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already in publication
    END;
  END IF;
END $$;

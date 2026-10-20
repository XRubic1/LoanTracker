-- Daily MOTUS check: four staggered runs (each takes a quarter of the clients) at 10:00-10:15 UTC.
-- Creates pending cancellation suggestions; nothing is changed until a person approves them.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  fn_url text := 'https://xntxsecsdzqhpfcohylh.supabase.co/functions/v1/motus-daily-sync';
  i int;
BEGIN
  FOR i IN 0..3 LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'motus-daily-part-' || i) THEN
      PERFORM cron.unschedule('motus-daily-part-' || i);
    END IF;
    PERFORM cron.schedule(
      'motus-daily-part-' || i,
      format('%s 10 * * *', i * 5),
      format(
        $job$
        SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{"trigger": "cron", "part": %s, "parts": 4}'::jsonb,
          timeout_milliseconds := 150000
        ) AS request_id;
        $job$,
        fn_url,
        i
      )
    );
  END LOOP;
END $$;

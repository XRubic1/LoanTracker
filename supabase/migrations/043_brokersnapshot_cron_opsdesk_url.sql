-- Point BrokerSnapshot weekly cron at the OpsDesk project URL.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'brokersnapshot-weekly-monday') THEN
    PERFORM cron.unschedule('brokersnapshot-weekly-monday');
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

DO $$
DECLARE
  fn_url text := 'https://vghlrzpqioyuejkepokw.supabase.co/functions/v1/brokersnapshot-sync';
BEGIN
  PERFORM cron.schedule(
    'brokersnapshot-weekly-monday',
    '0 6 * * 1',
    format(
      $job$
      SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"trigger": "cron"}'::jsonb,
        timeout_milliseconds := 600000
      ) AS request_id;
      $job$,
      fn_url
    )
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron/pg_net not available — schedule via Dashboard if needed.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not reschedule brokersnapshot cron: %', SQLERRM;
END $$;

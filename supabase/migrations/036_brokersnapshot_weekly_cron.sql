-- Schedule BrokerSnapshot sync every Monday at 06:00 UTC (owner account via BROKERSNAPSHOT_CRON_OWNER_ID).
-- Requires pg_cron + pg_net (enabled on Supabase hosted projects).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove previous schedule if re-running migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'brokersnapshot-weekly-monday') THEN
    PERFORM cron.unschedule('brokersnapshot-weekly-monday');
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

-- Project URL for this deployment (xntxsecsdzqhpfcohylh). Edit if using another project.
DO $$
DECLARE
  fn_url text := 'https://xntxsecsdzqhpfcohylh.supabase.co/functions/v1/brokersnapshot-sync';
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
    RAISE NOTICE 'pg_cron/pg_net not available — schedule via Supabase Dashboard → Cron → Edge Function (Mondays 06:00 UTC).';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule brokersnapshot cron: %', SQLERRM;
END $$;

COMMENT ON EXTENSION pg_cron IS 'BrokerSnapshot: weekly Monday sync via brokersnapshot-weekly-monday job.';

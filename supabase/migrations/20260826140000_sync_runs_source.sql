-- Tell BrokerSnapshot runs and MOTUS runs apart in the shared sync-run log.
ALTER TABLE public.brokersnapshot_sync_runs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'brokersnapshot';

COMMENT ON COLUMN public.brokersnapshot_sync_runs.source IS
  'Which check produced this run: brokersnapshot or motus.';

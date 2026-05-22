-- Allow worksheet entries for clients not yet on the registry (free-text name).

ALTER TABLE public.worksheet_entries
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.worksheet_entries
  ADD COLUMN IF NOT EXISTS client_name TEXT;

COMMENT ON COLUMN public.worksheet_entries.client_name IS 'Display name when client_id is null (not on Clients list).';

ALTER TABLE public.worksheet_entries
  DROP CONSTRAINT IF EXISTS worksheet_entries_client_ref_check;

ALTER TABLE public.worksheet_entries
  ADD CONSTRAINT worksheet_entries_client_ref_check CHECK (
    client_id IS NOT NULL
    OR (client_name IS NOT NULL AND btrim(client_name) <> '')
  );

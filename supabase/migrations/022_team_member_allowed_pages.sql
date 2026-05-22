-- Per-team-member tab visibility (JSON array of page ids).

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS allowed_pages JSONB;

COMMENT ON COLUMN public.team_members.allowed_pages IS 'Array of PageId strings this member may access; null = all assignable tabs.';

-- Owner may update tab permissions for their invites (member claim still uses existing update policy).
DROP POLICY IF EXISTS "team_members_update_owner" ON public.team_members;

CREATE POLICY "team_members_update_owner" ON public.team_members FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

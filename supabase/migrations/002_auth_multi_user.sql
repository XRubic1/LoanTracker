-- Multi-user auth: owner_id on data, team_members for sub-users
-- Run after 001_initial.sql. Requires Supabase Auth enabled.

-- Add owner_id to loans and reserves (nullable for existing rows)
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reserves ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_loans_owner_id ON public.loans (owner_id);
CREATE INDEX IF NOT EXISTS idx_reserves_owner_id ON public.reserves (owner_id);

-- Team members: owner invites by email; when they sign up, member_id is set
CREATE TABLE IF NOT EXISTS public.team_members (
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_owner_id ON public.team_members (owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON public.team_members (member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members (email);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helper: effective owner for current user (self if owner, else owner from team_members)
CREATE OR REPLACE FUNCTION public.effective_owner_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid() LIMIT 1),
    auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all on loans" ON public.loans;
DROP POLICY IF EXISTS "Allow all on reserves" ON public.reserves;

-- Loans: user sees rows where they are owner, or member of that owner, or legacy (owner_id null)
CREATE POLICY "loans_select" ON public.loans FOR SELECT
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

CREATE POLICY "loans_insert" ON public.loans FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "loans_update" ON public.loans FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  )
  WITH CHECK (true);

CREATE POLICY "loans_delete" ON public.loans FOR DELETE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

-- Reserves: same as loans
CREATE POLICY "reserves_select" ON public.reserves FOR SELECT
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

CREATE POLICY "reserves_insert" ON public.reserves FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "reserves_update" ON public.reserves FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  )
  WITH CHECK (true);

CREATE POLICY "reserves_delete" ON public.reserves FOR DELETE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

-- Team members: owner manages list; members can read their own rows; invited user can claim (update member_id)
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT
  USING (owner_id = auth.uid() OR member_id = auth.uid() OR (member_id IS NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid())));

CREATE POLICY "team_members_insert" ON public.team_members FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (member_id IS NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (true);

CREATE POLICY "team_members_delete" ON public.team_members FOR DELETE
  USING (owner_id = auth.uid());

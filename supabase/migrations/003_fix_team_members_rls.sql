-- Fix: app role cannot read auth.users. Use JWT email claim instead.
-- Run this after 002_auth_multi_user.sql if you see "permission denied for table users".

-- Helper: current user's email from JWT (no read on auth.users)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
  SELECT COALESCE(auth.jwt()->>'email', '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Recreate team_members policies to use current_user_email() instead of auth.users
DROP POLICY IF EXISTS "team_members_select" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update" ON public.team_members;

CREATE POLICY "team_members_select" ON public.team_members FOR SELECT
  USING (
    owner_id = auth.uid()
    OR member_id = auth.uid()
    OR (member_id IS NULL AND email = public.current_user_email())
  );

CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (member_id IS NULL AND email = public.current_user_email())
  )
  WITH CHECK (true);

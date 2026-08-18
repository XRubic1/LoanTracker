-- Super-admin emails (platform_admins) may register without a company/team invite.

CREATE OR REPLACE FUNCTION public.has_pending_invite(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_invites
    WHERE lower(email) = lower(trim(p_email)) AND claimed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE lower(email) = lower(trim(p_email)) AND member_id IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE lower(email) = lower(trim(p_email))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.has_pending_invite(TEXT) TO anon, authenticated;

-- AAA Fuel portal: a sister company (aaafuel@trufunding.net) that can only see and create
-- "AAA Mega Fuel" weekly payments. Access is decided by email in aaa_fuel_users.

CREATE TABLE IF NOT EXISTS public.aaa_fuel_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aaa_fuel_users_email_lower CHECK (email = lower(email))
);

-- No policies on purpose: only the SECURITY DEFINER functions below read this table.
ALTER TABLE public.aaa_fuel_users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.aaa_fuel_users (email) VALUES ('aaafuel@trufunding.net')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_aaa_fuel_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.aaa_fuel_users
    WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE ALL ON FUNCTION public.is_aaa_fuel_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_aaa_fuel_user() TO authenticated;

-- Allow the AAA Fuel email to register without a team invite.
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
  )
  OR EXISTS (
    SELECT 1 FROM public.aaa_fuel_users
    WHERE email = lower(trim(p_email))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.has_pending_invite(TEXT) TO anon, authenticated;

-- Which team created the entry: a team user, or the AAA Fuel company.
ALTER TABLE public.aaa_dues
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'team';

-- AAA Fuel can read (never change) AAA Mega Fuel rows from every team.
DROP POLICY IF EXISTS "aaa_dues_fuel_select" ON public.aaa_dues;
CREATE POLICY "aaa_dues_fuel_select" ON public.aaa_dues FOR SELECT
  USING (public.is_aaa_fuel_user() AND payee = 'AAA Mega Fuel');

DROP POLICY IF EXISTS "aaa_payments_fuel_select" ON public.aaa_payments;
CREATE POLICY "aaa_payments_fuel_select" ON public.aaa_payments FOR SELECT
  USING (public.is_aaa_fuel_user() AND payee = 'AAA Mega Fuel');

-- Client names AAA Fuel may pick from: every client on an active team (names only).
CREATE OR REPLACE FUNCTION public.aaa_fuel_clients()
RETURNS TABLE (name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT c.name
  FROM public.clients c
  JOIN public.companies co ON co.owner_id = c.owner_id AND co.status = 'active'
  WHERE public.is_aaa_fuel_user()
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_clients() TO authenticated;

-- Create a Mega Fuel payment for a client. The row goes to the team that owns the client.
CREATE OR REPLACE FUNCTION public.aaa_fuel_create_due(
  p_client TEXT,
  p_amount NUMERIC,
  p_week_start DATE
)
RETURNS public.aaa_dues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teams INT;
  v_owner UUID;
  v_name TEXT;
  v_row public.aaa_dues;
BEGIN
  IF NOT public.is_aaa_fuel_user() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than 0';
  END IF;
  IF p_week_start IS NULL THEN
    RAISE EXCEPTION 'Pick the week this is due';
  END IF;

  SELECT count(DISTINCT c.owner_id), min(c.name), (array_agg(c.owner_id))[1]
    INTO v_teams, v_name, v_owner
  FROM public.clients c
  JOIN public.companies co ON co.owner_id = c.owner_id AND co.status = 'active'
  WHERE lower(trim(c.name)) = lower(trim(p_client));

  IF v_teams = 0 THEN
    RAISE EXCEPTION 'Not Tru Client';
  END IF;
  IF v_teams > 1 THEN
    RAISE EXCEPTION 'This client is on more than one team. Contact TruFunding.';
  END IF;

  INSERT INTO public.aaa_dues (owner_id, client, payee, amount, week_start, source)
  VALUES (v_owner, v_name, 'AAA Mega Fuel', round(p_amount, 2), date_trunc('week', p_week_start)::date, 'fuel')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.aaa_fuel_create_due(TEXT, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aaa_fuel_create_due(TEXT, NUMERIC, DATE) TO authenticated;

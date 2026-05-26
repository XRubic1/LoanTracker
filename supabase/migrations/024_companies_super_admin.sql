-- Provisioned companies (super admin), invites, platform-admin global read, suspended tenant writes.

-- Tenant companies (team admin owner_id = tenant scope for loans/worksheet).
CREATE TABLE IF NOT EXISTS public.companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies (status);

-- Invites: team_admin (claims company) or member (claims team_members row).
CREATE TABLE IF NOT EXISTS public.company_invites (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('team_admin', 'member')),
  allowed_pages JSONB,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_invites_pending_email
  ON public.company_invites (company_id, lower(email))
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_invites_email ON public.company_invites (lower(email));

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- Company for current tenant owner (team admin or member's owner).
CREATE OR REPLACE FUNCTION public.company_for_owner(p_owner_id UUID)
RETURNS BIGINT AS $$
  SELECT id FROM public.companies WHERE owner_id = p_owner_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- True when tenant may write (no company row = legacy standalone; active = ok; suspended = false).
CREATE OR REPLACE FUNCTION public.tenant_writes_allowed()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      SELECT (c.status = 'active')
      FROM public.companies c
      WHERE c.owner_id = public.effective_owner_id()
      LIMIT 1
    ),
    true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Pending invite for email (auth page gate).
CREATE OR REPLACE FUNCTION public.has_pending_invite(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_invites
    WHERE lower(email) = lower(trim(p_email)) AND claimed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE lower(email) = lower(trim(p_email)) AND member_id IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.has_pending_invite(TEXT) TO anon, authenticated;

-- Claim pending company_invites for JWT email.
CREATE OR REPLACE FUNCTION public.claim_company_invites()
RETURNS void AS $$
DECLARE
  v_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_uid UUID := auth.uid();
  inv RECORD;
  v_owner_id UUID;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  FOR inv IN
    SELECT * FROM public.company_invites
    WHERE lower(email) = v_email AND claimed_at IS NULL
    ORDER BY created_at ASC
  LOOP
    IF inv.role = 'team_admin' THEN
      IF EXISTS (SELECT 1 FROM public.companies WHERE owner_id = v_uid AND id <> inv.company_id) THEN
        RAISE EXCEPTION 'User already admin of another company';
      END IF;
      UPDATE public.companies
      SET owner_id = v_uid, updated_at = NOW()
      WHERE id = inv.company_id AND owner_id IS NULL;
      UPDATE public.company_invites
      SET claimed_at = NOW(), claimed_by = v_uid
      WHERE id = inv.id;
    ELSIF inv.role = 'member' THEN
      SELECT owner_id INTO v_owner_id FROM public.companies WHERE id = inv.company_id;
      IF v_owner_id IS NULL THEN
        CONTINUE;
      END IF;
      INSERT INTO public.team_members (owner_id, email, allowed_pages)
      VALUES (
        v_owner_id,
        v_email,
        COALESCE(inv.allowed_pages, '["loans"]'::jsonb)
      )
      ON CONFLICT (owner_id, email) DO UPDATE
      SET allowed_pages = COALESCE(EXCLUDED.allowed_pages, team_members.allowed_pages);
      UPDATE public.company_invites
      SET claimed_at = NOW(), claimed_by = v_uid
      WHERE id = inv.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_company_invites() TO authenticated;

-- companies RLS
CREATE POLICY "companies_select" ON public.companies FOR SELECT
  USING (
    public.is_platform_admin()
    OR owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
  );

CREATE POLICY "companies_insert" ON public.companies FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "companies_update" ON public.companies FOR UPDATE
  USING (
    public.is_platform_admin()
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    public.is_platform_admin()
    OR owner_id = auth.uid()
  );

-- company_invites RLS
CREATE POLICY "company_invites_select" ON public.company_invites FOR SELECT
  USING (
    public.is_platform_admin()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

CREATE POLICY "company_invites_insert" ON public.company_invites FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

CREATE POLICY "company_invites_update" ON public.company_invites FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "company_invites_delete" ON public.company_invites FOR DELETE
  USING (
    public.is_platform_admin()
    OR company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

-- Platform admin read-all (oversight)
CREATE POLICY "loans_select_platform_admin" ON public.loans FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "reserves_select_platform_admin" ON public.reserves FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "worksheet_entries_select_platform_admin" ON public.worksheet_entries FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "team_members_select_platform_admin" ON public.team_members FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "clients_select_platform_admin" ON public.clients FOR SELECT
  USING (public.is_platform_admin());

-- Block writes when company suspended (loans)
DROP POLICY IF EXISTS "loans_insert" ON public.loans;
CREATE POLICY "loans_insert" ON public.loans FOR INSERT
  WITH CHECK ((owner_id = auth.uid() OR owner_id IS NULL) AND public.tenant_writes_allowed());

DROP POLICY IF EXISTS "loans_update" ON public.loans;
CREATE POLICY "loans_update" ON public.loans FOR UPDATE
  USING (
    (owner_id = auth.uid()
      OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
      OR owner_id IS NULL)
    AND public.tenant_writes_allowed()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "loans_delete" ON public.loans;
CREATE POLICY "loans_delete" ON public.loans FOR DELETE
  USING (
    (owner_id = auth.uid()
      OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
      OR owner_id IS NULL)
    AND public.tenant_writes_allowed()
  );

-- Reserves suspended guard
DROP POLICY IF EXISTS "reserves_insert" ON public.reserves;
CREATE POLICY "reserves_insert" ON public.reserves FOR INSERT
  WITH CHECK ((owner_id = auth.uid() OR owner_id IS NULL) AND public.tenant_writes_allowed());

DROP POLICY IF EXISTS "reserves_update" ON public.reserves;
CREATE POLICY "reserves_update" ON public.reserves FOR UPDATE
  USING (
    (owner_id = auth.uid()
      OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
      OR owner_id IS NULL)
    AND public.tenant_writes_allowed()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "reserves_delete" ON public.reserves;
CREATE POLICY "reserves_delete" ON public.reserves FOR DELETE
  USING (
    (owner_id = auth.uid()
      OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
      OR owner_id IS NULL)
    AND public.tenant_writes_allowed()
  );

-- Worksheet suspended guard
DROP POLICY IF EXISTS "worksheet_entries_insert" ON public.worksheet_entries;
CREATE POLICY "worksheet_entries_insert" ON public.worksheet_entries FOR INSERT
  WITH CHECK (
    owner_id = public.effective_owner_id()
    AND created_by = auth.uid()
    AND public.tenant_writes_allowed()
  );

DROP POLICY IF EXISTS "worksheet_entries_update" ON public.worksheet_entries;
CREATE POLICY "worksheet_entries_update" ON public.worksheet_entries FOR UPDATE
  USING (
    owner_id = public.effective_owner_id()
    AND (created_by = auth.uid() OR owner_id = auth.uid())
    AND public.tenant_writes_allowed()
  )
  WITH CHECK (
    owner_id = public.effective_owner_id()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "worksheet_entries_delete" ON public.worksheet_entries;
CREATE POLICY "worksheet_entries_delete" ON public.worksheet_entries FOR DELETE
  USING (
    owner_id = public.effective_owner_id()
    AND (created_by = auth.uid() OR owner_id = auth.uid())
    AND public.tenant_writes_allowed()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_writes_allowed() TO authenticated;

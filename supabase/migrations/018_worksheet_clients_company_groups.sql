-- Worksheet entries, master clients registry, company linking, platform admins.

-- Platform super-admins (RLS source of truth for company group writes).
CREATE TABLE IF NOT EXISTS public.platform_admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT USING (auth.role() = 'authenticated');

-- After deploy, add your super-admin email (required for Admin panel RLS):
-- INSERT INTO public.platform_admins (email) VALUES ('you@example.com') ON CONFLICT DO NOTHING;

-- Company groups: link multiple owner accounts to share client lists.
CREATE TABLE IF NOT EXISTS public.owner_company_groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.owner_company_group_members (
  group_id BIGINT NOT NULL REFERENCES public.owner_company_groups(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_company_group_members_owner ON public.owner_company_group_members (owner_id);

ALTER TABLE public.owner_company_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_company_group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Effective owner plus all owners in the same company group.
CREATE OR REPLACE FUNCTION public.linked_owner_ids()
RETURNS SETOF UUID AS $$
  WITH base AS (
    SELECT public.effective_owner_id() AS oid
  ),
  group_ids AS (
    SELECT DISTINCT m.group_id
    FROM public.owner_company_group_members m
    WHERE m.owner_id IN (SELECT oid FROM base)
  )
  SELECT oid FROM base
  UNION
  SELECT DISTINCT m.owner_id
  FROM public.owner_company_group_members m
  WHERE m.group_id IN (SELECT group_id FROM group_ids);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Master client registry (per owner).
CREATE TABLE IF NOT EXISTS public.clients (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expenses TEXT, -- Wire or ACH
  warning_note TEXT,
  is_new_client BOOLEAN NOT NULL DEFAULT false,
  started_date DATE,
  new_client_reviewed BOOLEAN NOT NULL DEFAULT false,
  verification_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, name)
);

CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON public.clients (owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (name);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select" ON public.clients FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id IS NULL
  );

CREATE POLICY "clients_insert" ON public.clients FOR INSERT
  WITH CHECK (
    owner_id = public.effective_owner_id()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

CREATE POLICY "clients_update" ON public.clients FOR UPDATE
  USING (
    owner_id = public.effective_owner_id()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  )
  WITH CHECK (true);

CREATE POLICY "clients_delete" ON public.clients FOR DELETE
  USING (
    owner_id = public.effective_owner_id()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

-- Worksheet batch log (per user).
CREATE TABLE IF NOT EXISTS public.worksheet_entries (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  group_work BOOLEAN NOT NULL DEFAULT false,
  verified BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worksheet_entries_owner ON public.worksheet_entries (owner_id);
CREATE INDEX IF NOT EXISTS idx_worksheet_entries_created_by ON public.worksheet_entries (created_by);
CREATE INDEX IF NOT EXISTS idx_worksheet_entries_work_date ON public.worksheet_entries (work_date);

ALTER TABLE public.worksheet_entries ENABLE ROW LEVEL SECURITY;

-- Members: own rows only. Owner: all rows for their tenant.
CREATE POLICY "worksheet_entries_select" ON public.worksheet_entries FOR SELECT
  USING (
    owner_id = public.effective_owner_id()
    AND (
      created_by = auth.uid()
      OR owner_id = auth.uid()
    )
  );

CREATE POLICY "worksheet_entries_insert" ON public.worksheet_entries FOR INSERT
  WITH CHECK (
    owner_id = public.effective_owner_id()
    AND created_by = auth.uid()
    AND (
      created_by = auth.uid()
      OR owner_id = auth.uid()
    )
  );

CREATE POLICY "worksheet_entries_update" ON public.worksheet_entries FOR UPDATE
  USING (
    owner_id = public.effective_owner_id()
    AND (
      created_by = auth.uid()
      OR owner_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = public.effective_owner_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "worksheet_entries_delete" ON public.worksheet_entries FOR DELETE
  USING (
    owner_id = public.effective_owner_id()
    AND (
      created_by = auth.uid()
      OR owner_id = auth.uid()
    )
  );

-- Company groups: platform admin writes; members in group can read.
CREATE POLICY "company_groups_select" ON public.owner_company_groups FOR SELECT
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.owner_company_group_members m
      WHERE m.group_id = id
        AND m.owner_id IN (SELECT public.linked_owner_ids())
    )
  );

CREATE POLICY "company_groups_insert" ON public.owner_company_groups FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "company_groups_update" ON public.owner_company_groups FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "company_groups_delete" ON public.owner_company_groups FOR DELETE
  USING (public.is_platform_admin());

CREATE POLICY "company_group_members_select" ON public.owner_company_group_members FOR SELECT
  USING (
    public.is_platform_admin()
    OR owner_id IN (SELECT public.linked_owner_ids())
  );

CREATE POLICY "company_group_members_insert" ON public.owner_company_group_members FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "company_group_members_delete" ON public.owner_company_group_members FOR DELETE
  USING (public.is_platform_admin());

-- Resolve owner UUID by email (admin panel).
CREATE OR REPLACE FUNCTION public.owner_id_by_email(p_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.owner_id_by_email(TEXT) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worksheet_entries;

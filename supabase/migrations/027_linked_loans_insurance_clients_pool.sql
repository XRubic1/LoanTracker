-- Linked groups: share loans + insurance SELECT across owner_company_group_members.
-- All provisioned companies (super admin): share client list SELECT across every claimed company.

-- Loans: read rows for any owner in linked_owner_ids() (includes company link groups).
CREATE POLICY "loans_select_linked" ON public.loans FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id IS NULL
  );

-- Client insurance + verification: same linked visibility for SELECT.
DROP POLICY IF EXISTS "client_insurance_select" ON public.client_insurance;
CREATE POLICY "client_insurance_select" ON public.client_insurance FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

DROP POLICY IF EXISTS "insurance_verification_select" ON public.insurance_verification;
CREATE POLICY "insurance_verification_select" ON public.insurance_verification FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
  );

-- Clients: all provisioned companies (super admin) see each other's client registry.
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT
  USING (
    owner_id IN (SELECT public.linked_owner_ids())
    OR owner_id IN (SELECT owner_id FROM public.companies WHERE owner_id IS NOT NULL)
    OR owner_id IS NULL
  );

-- Cancellation audit follows visible client_insurance rows.
DROP POLICY IF EXISTS "cancellation_audit_select" ON public.client_insurance_cancellation_audit;
CREATE POLICY "cancellation_audit_select" ON public.client_insurance_cancellation_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.client_insurance ci
      WHERE ci.id = client_insurance_id
        AND (
          ci.owner_id IN (SELECT public.linked_owner_ids())
          OR ci.owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
          OR ci.owner_id = auth.uid()
          OR ci.owner_id IS NULL
        )
    )
  );

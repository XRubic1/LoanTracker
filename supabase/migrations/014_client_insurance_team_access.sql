-- Allow owner team members to view/edit Client Insurance and weekly verification.
-- Aligns access with loans/reserves multi-user policies.

-- client_insurance: replace owner-only policies with owner-or-team-member access.
DROP POLICY IF EXISTS "client_insurance_select" ON public.client_insurance;
DROP POLICY IF EXISTS "client_insurance_insert" ON public.client_insurance;
DROP POLICY IF EXISTS "client_insurance_update" ON public.client_insurance;
DROP POLICY IF EXISTS "client_insurance_delete" ON public.client_insurance;

CREATE POLICY "client_insurance_select" ON public.client_insurance FOR SELECT
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

CREATE POLICY "client_insurance_insert" ON public.client_insurance FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

CREATE POLICY "client_insurance_update" ON public.client_insurance FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  )
  WITH CHECK (true);

CREATE POLICY "client_insurance_delete" ON public.client_insurance FOR DELETE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IS NULL
  );

-- insurance_verification: same owner-or-team-member visibility/edit.
DROP POLICY IF EXISTS "insurance_verification_select" ON public.insurance_verification;
DROP POLICY IF EXISTS "insurance_verification_insert" ON public.insurance_verification;
DROP POLICY IF EXISTS "insurance_verification_update" ON public.insurance_verification;
DROP POLICY IF EXISTS "insurance_verification_delete" ON public.insurance_verification;

CREATE POLICY "insurance_verification_select" ON public.insurance_verification FOR SELECT
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
  );

CREATE POLICY "insurance_verification_insert" ON public.insurance_verification FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
  );

CREATE POLICY "insurance_verification_update" ON public.insurance_verification FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
  )
  WITH CHECK (true);

CREATE POLICY "insurance_verification_delete" ON public.insurance_verification FOR DELETE
  USING (
    owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
  );

-- client_insurance_cancellation_audit: allow audit rows for accessible client_insurance owners.
DROP POLICY IF EXISTS "cancellation_audit_select" ON public.client_insurance_cancellation_audit;
DROP POLICY IF EXISTS "cancellation_audit_insert" ON public.client_insurance_cancellation_audit;
DROP POLICY IF EXISTS "cancellation_audit_delete" ON public.client_insurance_cancellation_audit;

CREATE POLICY "cancellation_audit_select" ON public.client_insurance_cancellation_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.client_insurance ci
      WHERE ci.id = client_insurance_id
        AND (
          ci.owner_id = auth.uid()
          OR ci.owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
          OR ci.owner_id IS NULL
        )
    )
  );

CREATE POLICY "cancellation_audit_insert" ON public.client_insurance_cancellation_audit
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_insurance ci
      WHERE ci.id = client_insurance_id
        AND (
          ci.owner_id = auth.uid()
          OR ci.owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
          OR ci.owner_id IS NULL
        )
    )
  );

CREATE POLICY "cancellation_audit_delete" ON public.client_insurance_cancellation_audit
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.client_insurance ci
      WHERE ci.id = client_insurance_id
        AND (
          ci.owner_id = auth.uid()
          OR ci.owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
          OR ci.owner_id IS NULL
        )
    )
  );

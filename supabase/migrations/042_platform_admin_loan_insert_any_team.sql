-- Platform admins may insert loans for any active provisioned company (team picker in UI).
-- Team members / owners keep inserting under effective_owner_id() only.

DROP POLICY IF EXISTS "loans_insert" ON public.loans;
CREATE POLICY "loans_insert" ON public.loans FOR INSERT
  WITH CHECK (
    (
      (owner_id = public.effective_owner_id() OR owner_id IS NULL)
      AND public.tenant_writes_allowed()
    )
    OR (
      public.is_platform_admin()
      AND owner_id IN (
        SELECT c.owner_id
        FROM public.companies c
        WHERE c.owner_id IS NOT NULL
          AND c.status = 'active'
      )
    )
  );

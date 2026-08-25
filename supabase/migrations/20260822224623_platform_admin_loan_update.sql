-- Platform admins may update loans for any active provisioned company
-- (close installments / close loans from Super Admin).

DROP POLICY IF EXISTS "loans_update_platform_admin" ON public.loans;
CREATE POLICY "loans_update_platform_admin" ON public.loans FOR UPDATE
  USING (
    public.is_platform_admin()
    AND (
      owner_id IS NULL
      OR owner_id IN (
        SELECT c.owner_id
        FROM public.companies c
        WHERE c.owner_id IS NOT NULL
          AND c.status = 'active'
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    AND (
      owner_id IS NULL
      OR owner_id IN (
        SELECT c.owner_id
        FROM public.companies c
        WHERE c.owner_id IS NOT NULL
          AND c.status = 'active'
      )
    )
  );

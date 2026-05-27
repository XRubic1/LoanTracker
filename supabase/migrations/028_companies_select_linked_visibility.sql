-- Allow linked teams to read each other's company names for UI team labels.

DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT
  USING (
    public.is_platform_admin()
    OR owner_id = auth.uid()
    OR owner_id IN (SELECT owner_id FROM public.team_members WHERE member_id = auth.uid())
    OR owner_id IN (SELECT public.linked_owner_ids())
  );

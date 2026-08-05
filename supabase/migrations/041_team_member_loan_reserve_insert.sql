-- Allow team members to add loans/reserves under their team's owner_id
-- (same pattern as worksheet_entries_insert using effective_owner_id()).
-- Previously INSERT required owner_id = auth.uid(), so only the team admin
-- could create rows even though the UI called insert with the team owner id.

DROP POLICY IF EXISTS "loans_insert" ON public.loans;
CREATE POLICY "loans_insert" ON public.loans FOR INSERT
  WITH CHECK (
    (owner_id = public.effective_owner_id() OR owner_id IS NULL)
    AND public.tenant_writes_allowed()
  );

DROP POLICY IF EXISTS "reserves_insert" ON public.reserves;
CREATE POLICY "reserves_insert" ON public.reserves FOR INSERT
  WITH CHECK (
    (owner_id = public.effective_owner_id() OR owner_id IS NULL)
    AND public.tenant_writes_allowed()
  );

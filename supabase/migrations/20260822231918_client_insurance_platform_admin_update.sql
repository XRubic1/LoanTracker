-- Platform admins may update any client_insurance row (e.g. add missing DOT).

DROP POLICY IF EXISTS "client_insurance_update_platform_admin" ON public.client_insurance;
CREATE POLICY "client_insurance_update_platform_admin" ON public.client_insurance
  FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

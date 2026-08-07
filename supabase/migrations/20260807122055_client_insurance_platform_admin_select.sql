-- Platform admins can read all client_insurance rows (oversight dashboard).
CREATE POLICY "client_insurance_select_platform_admin" ON public.client_insurance
  FOR SELECT
  USING (public.is_platform_admin());

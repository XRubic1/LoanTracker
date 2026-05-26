-- Allow existing platform admins to grant/revoke super-admin access from the app.

CREATE POLICY "platform_admins_insert" ON public.platform_admins
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform_admins_delete" ON public.platform_admins
  FOR DELETE
  USING (public.is_platform_admin());

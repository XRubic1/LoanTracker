-- The original (first-added) super-admin email cannot be deleted.

CREATE OR REPLACE FUNCTION public.prevent_delete_primary_platform_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  primary_email TEXT;
BEGIN
  SELECT email
  INTO primary_email
  FROM public.platform_admins
  ORDER BY created_at ASC NULLS LAST, email ASC
  LIMIT 1;

  IF primary_email IS NOT NULL AND lower(OLD.email) = lower(primary_email) THEN
    RAISE EXCEPTION 'The primary super-admin email cannot be removed.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS platform_admins_protect_primary ON public.platform_admins;

CREATE TRIGGER platform_admins_protect_primary
  BEFORE DELETE ON public.platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_primary_platform_admin();

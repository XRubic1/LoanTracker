/**
 * Platform super-admin check for Admin panel UI.
 * RLS uses platform_admins table; env provides additional gate for nav visibility.
 */
export function isPlatformAdmin(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const envList = import.meta.env.VITE_PLATFORM_ADMIN_EMAILS as string | undefined;
  if (envList) {
    const emails = envList.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (emails.includes(normalized)) return true;
  }
  return false;
}

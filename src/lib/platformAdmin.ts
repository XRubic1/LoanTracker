import { getSupabase } from '@/lib/supabase';

/**
 * Platform super-admin check for Admin panel UI.
 * Prefer DB (platform_admins + RLS); env list is a dev fallback.
 */
export function isPlatformAdminEnv(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const envList = import.meta.env.VITE_PLATFORM_ADMIN_EMAILS as string | undefined;
  if (envList) {
    const emails = envList.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (emails.includes(normalized)) return true;
  }
  return false;
}

/** DB-backed platform admin flag (aligns with RLS is_platform_admin()). */
export async function fetchIsPlatformAdmin(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) {
    console.warn('is_platform_admin:', error.message);
    return false;
  }
  return Boolean(data);
}

/** Env OR database platform admin. */
export async function resolveIsPlatformAdmin(email: string | undefined | null): Promise<boolean> {
  if (isPlatformAdminEnv(email)) return true;
  return fetchIsPlatformAdmin();
}

/** Email of the original (first-added) platform admin, if any. */
export function getPrimaryPlatformAdminEmail(
  admins: { email: string; created_at?: string }[]
): string | null {
  if (!admins.length) return null;
  const sorted = [...admins].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.email.localeCompare(b.email);
  });
  return sorted[0]?.email?.trim().toLowerCase() ?? null;
}

/** True for the original super-admin email, or emails listed in VITE_PLATFORM_ADMIN_EMAILS. */
export function isProtectedPlatformAdmin(
  email: string | undefined | null,
  admins: { email: string; created_at?: string }[]
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  if (isPlatformAdminEnv(normalized)) return true;
  return getPrimaryPlatformAdminEmail(admins) === normalized;
}

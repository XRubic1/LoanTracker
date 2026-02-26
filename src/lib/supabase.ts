import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Single Supabase client instance (avoids multiple GoTrueClient / lock issues) */
let supabaseInstance: SupabaseClient | null = null;

/** Supabase client; null if env not configured. Returns the same instance every time. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, anonKey);
  }
  return supabaseInstance;
}

export function isConfigMissing(): boolean {
  return !url || !anonKey;
}

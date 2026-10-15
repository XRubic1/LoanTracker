import { getSupabase } from '@/lib/supabase';
import type { MotusInsuranceReport } from '@/lib/motusInsurance';

function messageFromBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === 'string') return body.trim() || null;
  if (typeof body !== 'object') return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

async function messageFromInvokeError(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.clone !== 'function') return null;
  try {
    const raw = await ctx.clone().text();
    if (!raw.trim()) return null;
    try {
      return messageFromBody(JSON.parse(raw));
    } catch {
      return raw.trim().slice(0, 400);
    }
  } catch {
    return null;
  }
}

/** One signed-in MOTUS lookup. Any screen can call this. */
export async function lookupMotusInsurance(query: string): Promise<MotusInsuranceReport> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.functions.invoke('motus-insurance', {
    body: { query },
  });

  const payload = data as (MotusInsuranceReport & { error?: string }) | null;
  if (payload?.error) throw new Error(payload.error);
  if (payload?.dotNumber) return payload;

  const fromError = error ? await messageFromInvokeError(error) : null;
  throw new Error(fromError || 'MOTUS lookup failed');
}

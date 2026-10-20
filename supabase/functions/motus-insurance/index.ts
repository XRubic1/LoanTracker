import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { parseMotusQuery } from '../../../src/lib/motusInsurance.ts';
import { fetchMotusReport } from '../_shared/motusLookup.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireSignedIn(
  req: Request
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, status: 401, error: 'Sign in to look up MOTUS insurance.' };

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, error: 'Sign in to look up MOTUS insurance.' };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const signedIn = await requireSignedIn(req);
    if (!signedIn.ok) return jsonResponse({ error: signedIn.error }, signedIn.status);

    const payload = (await req.json().catch(() => ({}))) as { query?: string };
    const query = parseMotusQuery(String(payload.query ?? ''));
    if (!query) {
      return jsonResponse({ error: 'Enter a DOT number, an MC number, or a MOTUS account link.' }, 400);
    }

    const result = await fetchMotusReport(query);
    if (!result.ok) return jsonResponse({ error: result.error }, result.status);
    return jsonResponse(result.report);
  } catch {
    return jsonResponse({ error: 'MOTUS lookup failed' }, 500);
  }
});

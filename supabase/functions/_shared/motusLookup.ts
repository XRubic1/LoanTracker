/** MOTUS (FMCSA) lookup shared by the signed-in lookup and the daily sync. */
import {
  authorityIdsFromCarrier,
  buildMotusReport,
  type MotusInsuranceReport,
  type MotusQuery,
} from '../../../src/lib/motusInsurance.ts';

const MOTUS = 'https://motus.dot.gov/api';

type HttpResult = { ok: boolean; status: number; data: unknown };

async function getJson(url: string): Promise<HttpResult> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function motusFailed(result: { ok: boolean; status: number }): boolean {
  return !result.ok && result.status !== 404 && result.status !== 400;
}

/** First try, then two more after 600ms and 1200ms. 404 and 400 are not retried. */
async function getJsonRetry(url: string): Promise<HttpResult> {
  let result = await getJson(url);
  for (let attempt = 1; attempt < 3 && motusFailed(result); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    result = await getJson(url);
  }
  return result;
}

type DotResolution = { status: 'found'; dot: string } | { status: 'missing' } | { status: 'failed' };

async function dotFromDocket(prefix: string, number: string): Promise<DotResolution> {
  const where = encodeURIComponent(`docket_number='${prefix}${number}'`);
  const url = `https://data.transportation.gov/resource/c5y8-a4uz.json?$select=usdot_number&$where=${where}&$limit=1`;
  const result = await getJsonRetry(url);
  if (!result.ok) return motusFailed(result) ? { status: 'failed' } : { status: 'missing' };
  const row = Array.isArray(result.data) ? result.data[0] : null;
  const raw =
    row && typeof row === 'object' ? String((row as { usdot_number?: unknown }).usdot_number ?? '') : '';
  const digits = raw.replace(/\D/g, '');
  return digits ? { status: 'found', dot: digits } : { status: 'missing' };
}

async function resolveDot(query: MotusQuery): Promise<DotResolution> {
  if (query.kind === 'docket') return dotFromDocket(query.prefix, query.number);

  const direct = await getJsonRetry(`${MOTUS}/carriers/${query.dot}`);
  if (direct.ok && direct.data && typeof direct.data === 'object' && !Array.isArray(direct.data)) {
    return { status: 'found', dot: query.dot };
  }
  if (motusFailed(direct)) return { status: 'failed' };
  return dotFromDocket('MC', query.dot);
}

export type MotusLookupResult =
  | { ok: true; report: MotusInsuranceReport }
  | { ok: false; status: number; error: string };

/** Full MOTUS report for a DOT or docket. HTTP status mirrors what the lookup endpoint returns. */
export async function fetchMotusReport(query: MotusQuery): Promise<MotusLookupResult> {
  const resolved = await resolveDot(query);
  if (resolved.status === 'failed') return { ok: false, status: 502, error: 'MOTUS lookup failed' };
  if (resolved.status === 'missing') {
    return { ok: false, status: 404, error: 'No MOTUS account found for that number.' };
  }

  const carrier = await getJsonRetry(`${MOTUS}/carriers/${resolved.dot}`);
  if (motusFailed(carrier)) return { ok: false, status: 502, error: 'MOTUS lookup failed' };
  if (!carrier.ok || !carrier.data || typeof carrier.data !== 'object' || Array.isArray(carrier.data)) {
    return { ok: false, status: 404, error: 'No MOTUS account found for that number.' };
  }

  const ids = authorityIdsFromCarrier(carrier.data);
  const authorities = await Promise.all(
    ids.map(async (id) => {
      const [detail, minimumBipd] = await Promise.all([
        getJsonRetry(`${MOTUS}/regulatedEntity/oa/${id}/getOAPublicView`),
        getJsonRetry(`${MOTUS}/filings/minimum-bipd/${id}`),
      ]);
      return {
        viewFailed: !detail.ok,
        detail: detail.ok ? detail.data : null,
        minimumBipd: minimumBipd.ok ? minimumBipd.data : null,
      };
    })
  );
  if (authorities.some((row) => row.viewFailed)) {
    return { ok: false, status: 502, error: 'MOTUS lookup failed' };
  }

  const report = buildMotusReport({ dotNumber: resolved.dot, carrier: carrier.data, authorities });
  if (!report.authorities.length) {
    return {
      ok: false,
      status: 404,
      error: 'MOTUS has this DOT, but no operating authority was on the account.',
    };
  }
  return { ok: true, report };
}

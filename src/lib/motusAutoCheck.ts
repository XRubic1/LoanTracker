import { getSupabase } from '@/lib/supabase';
import { fetchPendingCancellationSuggestions } from '@/lib/supabase-db';
import { isInsuranceCancellationStatus } from '@/lib/clientInsuranceUtils';
import type { BrokerSnapshotCancellationSuggestion, ClientInsurance } from '@/types';

/** One automatic (or manual) MOTUS check run. */
export interface MotusRun {
  id: number;
  status: 'running' | 'success' | 'partial' | 'failed';
  trigger_source: 'cron' | 'manual';
  started_at: string;
  finished_at: string | null;
  clients_checked: number;
  cancellations_found: number;
  errors_count: number;
  error_summary: string | null;
}

/** A client whose MOTUS authority is inactive or has no insurance on file. */
export interface MotusInactiveFinding {
  client_insurance_id: number | null;
  client_name: string;
  dot: string;
  summary: string;
  checked_at: string;
}

export interface MotusAutoCheckData {
  runs: MotusRun[];
  /** Newly found cancellation dates waiting for approval. */
  suggestions: BrokerSnapshotCancellationSuggestion[];
  /** Inactive findings from the most recent day of runs. */
  inactive: MotusInactiveFinding[];
  /** Clients MOTUS showed as good (active insurance, no cancellation) in the most recent day of runs. */
  goodIds: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchMotusAutoCheck(ownerId?: string): Promise<MotusAutoCheckData> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const [{ data: runRows, error: runError }, pending] = await Promise.all([
    supabase
      .from('brokersnapshot_sync_runs')
      .select('*')
      .eq('source', 'motus')
      .order('started_at', { ascending: false })
      .limit(40),
    fetchPendingCancellationSuggestions(ownerId),
  ]);
  if (runError) throw runError;

  const runs = (runRows ?? []) as MotusRun[];
  const suggestions = pending.filter(
    (s) => s.source_data?.source === 'motus' || s.source_data?.motus_confirmed === true
  );

  let inactive: MotusInactiveFinding[] = [];
  let goodIds: number[] = [];
  const newest = runs[0] ? new Date(runs[0].started_at).getTime() : 0;
  const latestIds = runs.filter((r) => newest - new Date(r.started_at).getTime() < DAY_MS).map((r) => r.id);
  if (latestIds.length) {
    const { data: logs, error: logError } = await supabase
      .from('brokersnapshot_api_logs')
      .select('client_insurance_id, client_name, dot, response_summary, created_at')
      .in('sync_run_id', latestIds)
      .eq('response_summary->>verdict', 'inactive')
      .limit(500);
    if (logError) throw logError;
    const { data: goodLogs, error: goodError } = await supabase
      .from('brokersnapshot_api_logs')
      .select('client_insurance_id')
      .in('sync_run_id', latestIds)
      .eq('response_summary->>verdict', 'good')
      .limit(2000);
    if (goodError) throw goodError;
    goodIds = [
      ...new Set(
        ((goodLogs ?? []) as { client_insurance_id: number | null }[])
          .map((log) => log.client_insurance_id)
          .filter((id): id is number => id != null)
      ),
    ];
    inactive = ((logs ?? []) as {
      client_insurance_id: number | null;
      client_name: string | null;
      dot: string | null;
      response_summary: { summary?: string } | null;
      created_at: string;
    }[]).map((log) => ({
      client_insurance_id: log.client_insurance_id,
      client_name: log.client_name ?? '—',
      dot: log.dot ?? '',
      summary: log.response_summary?.summary ?? 'Authority inactive or no insurance on file.',
      checked_at: log.created_at,
    }));
  }
  return { runs, suggestions, inactive, goodIds };
}

/** Inactive findings that matter: the app still shows the client as fine. */
export function actionableInactive(
  inactive: MotusInactiveFinding[],
  clientInsurance: ClientInsurance[]
): MotusInactiveFinding[] {
  return inactive.filter((finding) => {
    const record = clientInsurance.find((c) => c.id === finding.client_insurance_id);
    if (!record) return false;
    const status = (record.status ?? '').trim().toLowerCase();
    return status === 'ok' || status === '';
  });
}

/** Clients still marked as cancelling in the app although MOTUS now shows active insurance with no cancellation. */
export function pendingRenewals(data: MotusAutoCheckData, clientInsurance: ClientInsurance[]): ClientInsurance[] {
  const good = new Set(data.goodIds);
  return clientInsurance.filter((c) => good.has(c.id) && isInsuranceCancellationStatus(c.status));
}

/** How many issues the latest automatic check left open. */
export function countMotusIssues(data: MotusAutoCheckData, clientInsurance: ClientInsurance[]): number {
  return (
    data.suggestions.length +
    actionableInactive(data.inactive, clientInsurance).length +
    pendingRenewals(data, clientInsurance).length
  );
}

/** Run the check now for the signed-in user's team. */
export async function runMotusAutoCheckNow(): Promise<{ checked: number; suggestions: number; errors: number }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('motus-daily-sync', { body: { trigger: 'manual' } });
  if (error) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || error.message || 'MOTUS check failed');
  }
  const result = (data ?? {}) as { clients_checked?: number; suggestions?: number; errors_count?: number };
  return {
    checked: result.clients_checked ?? 0,
    suggestions: result.suggestions ?? 0,
    errors: result.errors_count ?? 0,
  };
}

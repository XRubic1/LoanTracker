import { useState } from 'react';
import { classifyMotusReport, motusQueryForRecord } from '@/lib/motusInsurance';
import { lookupMotusInsurance } from '@/lib/motusInsuranceClient';
import { confirmInsuranceRenewed, markInsuranceRenewed } from '@/lib/clientInsuranceUtils';
import type { ClientInsurance } from '@/types';

export type SaveInsurance = (id: number, record: ClientInsurance) => Promise<ClientInsurance>;

/** "Confirm COI received · Insurance renewed" — asks first, then marks the record OK. */
export function ConfirmRenewedButton({
  record,
  onSave,
  label = 'Confirm COI received · Insurance renewed',
}: {
  record: ClientInsurance;
  onSave: SaveInsurance;
  label?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!confirmInsuranceRenewed(record.client)) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(record.id, markInsuranceRenewed(record));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={() => void confirm()}
        className="whitespace-nowrap rounded-lg btn-primary px-2.5 py-1 text-[11px] disabled:opacity-60"
      >
        {saving ? 'Saving…' : label}
      </button>
      {error && <span className="text-[10px] text-red">{error}</span>}
    </div>
  );
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'renewed' }
  | { kind: 'not_renewed'; summary: string }
  | { kind: 'error'; message: string };

/** For a client past its cancellation date: check MOTUS, and once insurance is active, confirm the renewal. */
export function PastCancellationActions({ record, onSave }: { record: ClientInsurance; onSave?: SaveInsurance }) {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const query = motusQueryForRecord(record);

  const check = async () => {
    if (!query) return;
    setState({ kind: 'checking' });
    try {
      const classified = classifyMotusReport(await lookupMotusInsurance(query));
      setState(
        classified.verdict === 'good'
          ? { kind: 'renewed' }
          : { kind: 'not_renewed', summary: classified.summary }
      );
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'MOTUS lookup failed' });
    }
  };

  return (
    <div className="mt-1.5 flex flex-col items-start gap-1.5">
      {state.kind === 'renewed' && onSave ? (
        <>
          <span className="text-[11px] font-medium text-green">MOTUS shows active insurance, no cancellation.</span>
          <ConfirmRenewedButton record={record} onSave={onSave} />
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={!query || state.kind === 'checking'}
            onClick={() => void check()}
            title={query ? undefined : 'Add a DOT or MC to check this client on MOTUS'}
            className="whitespace-nowrap rounded-lg btn-primary px-2.5 py-1 text-[11px] disabled:opacity-60"
          >
            {state.kind === 'checking' ? 'Checking…' : 'Check if client has insurance'}
          </button>
          {state.kind === 'not_renewed' && (
            <span className="text-[11px] text-red">Still no active insurance on MOTUS. {state.summary}</span>
          )}
          {state.kind === 'error' && <span className="text-[11px] text-red">{state.message}</span>}
          {!query && <span className="text-[10px] text-muted">No DOT or MC on file.</span>}
        </>
      )}
    </div>
  );
}

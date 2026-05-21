import { useState } from 'react';
import { CheckBox } from '@/components/CheckBox';
import type { ClientInsurance } from '@/types';
import {
  getDaysUntilNewClientReview,
  getNewClientReviewDueDate,
  isNewClientNeedsReview,
} from '@/lib/clientInsuranceUtils';

interface NewClientReviewPanelProps {
  client: ClientInsurance;
  onSave: (record: ClientInsurance) => Promise<unknown>;
}

/**
 * New-client verification: review checkbox, extend period, or remove new-client status.
 */
export function NewClientReviewPanel({ client, onSave }: NewClientReviewPanelProps) {
  const [extendDays, setExtendDays] = useState('14');
  const [saving, setSaving] = useState(false);

  const dueDate = getNewClientReviewDueDate(client);
  const daysUntil = getDaysUntilNewClientReview(client);
  const needsReview = isNewClientNeedsReview(client);

  const persist = async (record: ClientInsurance) => {
    setSaving(true);
    try {
      await onSave(record);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReviewedToggle = () => {
    void persist({
      ...client,
      new_client_reviewed: !client.new_client_reviewed,
    });
  };

  const handleExtend = () => {
    const add = parseInt(extendDays, 10);
    if (!add || add < 1) {
      window.alert('Enter a positive number of days to extend.');
      return;
    }
    void persist({
      ...client,
      verification_days: (client.verification_days ?? 30) + add,
      new_client_reviewed: false,
    });
  };

  const handleRemoveNewClient = () => {
    if (
      !window.confirm(
        `Remove new-client tracking for "${client.client}"? Start date and review status will be cleared.`
      )
    ) {
      return;
    }
    void persist({
      ...client,
      is_new_client: false,
      started_date: null,
      new_client_reviewed: false,
      verification_days: 30,
    });
  };

  const startedLabel = client.started_date
    ? new Date(client.started_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const dueLabel = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return (
    <div
      className={`rounded-lg border px-3 py-3 space-y-3 ${
        needsReview ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted mb-1">New client</p>
          <p className="text-[13px] text-ink">
            Started {startedLabel}
            <span className="text-muted2">
              {' · '}
              Review due {dueLabel}
              {client.verification_days != null && ` (${client.verification_days} days)`}
            </span>
          </p>
          {needsReview && (
            <p className="text-[12px] text-accent font-medium mt-1">
              Review required — verification period ended
              {daysUntil != null && daysUntil < 0
                ? ` (${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago)`
                : ''}
            </p>
          )}
          {!needsReview && !client.new_client_reviewed && daysUntil != null && daysUntil > 0 && (
            <p className="text-[12px] text-muted2 mt-1">
              Review in {daysUntil} day{daysUntil === 1 ? '' : 's'}
            </p>
          )}
          {client.new_client_reviewed && (
            <p className="text-[12px] text-green mt-1">Client reviewed</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CheckBox
          checked={client.new_client_reviewed}
          onToggle={handleReviewedToggle}
          disabled={saving}
        />
        <button
          type="button"
          onClick={handleReviewedToggle}
          disabled={saving}
          className="text-[13px] text-ink hover:text-accent transition-colors disabled:opacity-50"
        >
          Client reviewed
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-border">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Extend verification (days)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[13px] text-ink"
          />
        </div>
        <button
          type="button"
          onClick={handleExtend}
          disabled={saving}
          className="py-1.5 px-3 rounded-lg border border-border text-xs font-medium text-muted2 hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Extend period
        </button>
        <button
          type="button"
          onClick={handleRemoveNewClient}
          disabled={saving}
          className="py-1.5 px-3 rounded-lg border border-red/30 text-red text-xs font-medium hover:bg-red/10 disabled:opacity-50"
        >
          Remove new client
        </button>
      </div>
    </div>
  );
}

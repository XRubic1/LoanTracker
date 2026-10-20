import { CLIENT_EXPENSE_OPTIONS, type ClientExpenseType } from '@/types';

interface ClientExpenseFieldsProps {
  method: ClientExpenseType | '';
  achAmount: string;
  wireAmount: string;
  onMethodChange: (v: ClientExpenseType | '') => void;
  onAchChange: (v: string) => void;
  onWireChange: (v: string) => void;
}

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink tabular-nums';
const labelClass = 'block text-[11px] text-muted uppercase tracking-wider mb-1.5';

/** Expense amounts for ACH and Wire, plus which one this client uses. */
export function ClientExpenseFields({
  method,
  achAmount,
  wireAmount,
  onMethodChange,
  onAchChange,
  onWireChange,
}: ClientExpenseFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>ACH expense ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={achAmount}
            onChange={(e) => onAchChange(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Wire expense ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={wireAmount}
            onChange={(e) => onWireChange(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Client goes with</label>
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as ClientExpenseType | '')}
          className={inputClass}
        >
          <option value="">—</option>
          {CLIENT_EXPENSE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

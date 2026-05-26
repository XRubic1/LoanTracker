import type { TeamScopeFilterValue, TeamScopeOption } from '@/lib/linkedTeams';

interface TeamScopeFilterProps {
  label?: string;
  value: TeamScopeFilterValue;
  options: TeamScopeOption[];
  onChange: (value: TeamScopeFilterValue) => void;
  /** Hide when only one team (no linked accounts). */
  hideWhenSingle?: boolean;
}

/** Filter dropdown: All teams | per linked company name. */
export function TeamScopeFilter({
  label = 'Team',
  value,
  options,
  onChange,
  hideWhenSingle = true,
}: TeamScopeFilterProps) {
  const teamChoices = options.filter((o) => o.value !== 'all');
  if (hideWhenSingle && teamChoices.length <= 1) return null;

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TeamScopeFilterValue)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink min-w-[160px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

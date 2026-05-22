import type { TeamCoverageRow } from '@/lib/userActivityStats';
import { fmtDate } from '@/lib/utils';

interface TeamCoveragePanelProps {
  rows: TeamCoverageRow[];
  onSelectUser?: (userId: string) => void;
}

const STATUS_LABEL: Record<TeamCoverageRow['status'], string> = {
  active: 'Logged work',
  inactive: 'No batches',
  pending: 'Pending invite',
};

const STATUS_CLASS: Record<TeamCoverageRow['status'], string> = {
  active: 'text-green',
  inactive: 'text-accent',
  pending: 'text-muted2',
};

/** Who reported worksheet batches in the period (and who did not). */
export function TeamCoveragePanel({ rows, onSelectUser }: TeamCoveragePanelProps) {
  const inactive = rows.filter((r) => r.status === 'inactive').length;
  const pending = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="panel-surface overflow-hidden">
      <div className="px-4 py-[11px] border-b border-border flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
          Team coverage
        </span>
        <span className="text-[11px] text-muted2">
          {inactive > 0 && `${inactive} with no batches`}
          {inactive > 0 && pending > 0 && ' · '}
          {pending > 0 && `${pending} pending`}
          {inactive === 0 && pending === 0 && 'Everyone logged work'}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const clickable = r.userId && onSelectUser;
          return (
            <li key={r.userId ?? r.email}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => r.userId && onSelectUser?.(r.userId)}
                className={`w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors ${
                  clickable ? 'hover:bg-row-hover cursor-pointer' : 'cursor-default'
                }`}
              >
                <span className="flex-1 min-w-[120px] text-[13px] font-medium text-ink truncate">
                  {r.label}
                  {r.email && r.label !== r.email && (
                    <span className="block text-[11px] font-normal text-muted2 truncate">{r.email}</span>
                  )}
                </span>
                <span className={`text-[11px] font-medium ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                <span className="text-[12px] tabular-nums text-muted2 w-24 text-right">
                  {r.batches > 0 ? (
                    <>
                      {r.batches} batch{r.batches !== 1 ? 'es' : ''}
                      <span className="block text-[10px]">{r.invoices} inv.</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="text-[11px] text-muted2 w-20 text-right">
                  {r.lastActiveDate ? fmtDate(r.lastActiveDate) : '—'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

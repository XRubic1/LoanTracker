import type { TeamCoverageRow } from '@/lib/userActivityStats';
import { fmtDate } from '@/lib/utils';

interface TeamCoveragePanelProps {
  rows: TeamCoverageRow[];
  onSelectUser?: (userId: string) => void;
}

const STATUS_DOT: Record<TeamCoverageRow['status'], string> = {
  active: 'bg-green',
  inactive: 'bg-accent',
  pending: 'bg-muted2',
};

const STATUS_LABEL: Record<TeamCoverageRow['status'], string> = {
  active: 'Active',
  inactive: 'No batches',
  pending: 'Pending',
};

/** Who reported worksheet batches in the period (and who did not). */
export function TeamCoveragePanel({ rows, onSelectUser }: TeamCoveragePanelProps) {
  const active = rows.filter((r) => r.status === 'active').length;
  const inactive = rows.filter((r) => r.status === 'inactive').length;
  const pending = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="panel-surface overflow-hidden">
      <div className="px-4 py-[11px] border-b border-border flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
          Team coverage
        </span>
        <div className="flex items-center gap-3 text-[11px] text-muted2">
          <span><span className="text-green font-medium">{active}</span> active</span>
          {inactive > 0 && <span><span className="text-accent font-medium">{inactive}</span> no batches</span>}
          {pending > 0 && <span>{pending} pending</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[520px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-label">
              <th className="text-left font-normal px-4 py-2">Member</th>
              <th className="text-center font-normal px-4 py-2 w-24">Status</th>
              <th className="text-right font-normal px-4 py-2 w-20">Batches</th>
              <th className="text-right font-normal px-4 py-2 w-20">Invoices</th>
              <th className="text-right font-normal px-4 py-2 w-24">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const clickable = Boolean(r.userId && onSelectUser && r.status !== 'pending');
              return (
                <tr
                  key={r.userId ?? r.email}
                  className={`border-b border-border last:border-b-0 ${clickable ? 'row-hover cursor-pointer' : ''}`}
                  onClick={() => clickable && r.userId && onSelectUser?.(r.userId)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && clickable && r.userId && onSelectUser?.(r.userId)
                  }
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? 'button' : undefined}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-ink">{r.label}</span>
                    {r.email && r.label !== r.email && (
                      <span className="block text-[11px] text-muted2">{r.email}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[r.status]}`} />
                      <span className="text-muted2">{STATUS_LABEL[r.status]}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                    {r.batches > 0 ? r.batches : <span className="text-muted2">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted2">
                    {r.invoices > 0 ? r.invoices : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-muted2">
                    {r.lastActiveDate ? fmtDate(r.lastActiveDate) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

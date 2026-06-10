import type { WorkDurationFinding } from '@/lib/worksheetTiming';
import { WORK_DURATION_MARGIN_MINUTES, WORK_MINUTES_PER_INVOICE } from '@/lib/worksheetTiming';
import { fmtDateTime } from '@/lib/utils';
import type { WorksheetEntry } from '@/types';

export interface WorkPaceReviewRow {
  finding: WorkDurationFinding;
  entry: WorksheetEntry;
  userLabel: string;
  clientName: string;
}

interface WorkPaceReviewPanelProps {
  rows: WorkPaceReviewRow[];
  onSelectEntry?: (entryId: number) => void;
}

/** Lists batches flagged for slow or fast pace between same-day logs. Hidden when empty. */
export function WorkPaceReviewPanel({ rows, onSelectEntry }: WorkPaceReviewPanelProps) {
  if (rows.length === 0) return null;

  const slow = rows.filter((r) => r.finding.review === 'slow');
  const fast = rows.filter((r) => r.finding.review === 'fast');

  return (
    <div className="panel-surface overflow-hidden mb-5">
      <div className="px-4 py-[11px] border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
            Work pace review
          </span>
          <span className="ml-2 text-[11px] text-muted2">
            {WORK_MINUTES_PER_INVOICE} min/invoice + {WORK_DURATION_MARGIN_MINUTES} min margin between same-day
            batches
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {slow.length > 0 && (
            <span>
              <span className="font-semibold text-accent2">{slow.length}</span>
              <span className="text-muted2"> slow</span>
            </span>
          )}
          {fast.length > 0 && (
            <span>
              <span className="font-semibold text-yellow">{fast.length}</span>
              <span className="text-muted2"> fast</span>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
              <th className="text-left font-normal px-4 py-2.5">User</th>
              <th className="text-left font-normal px-4 py-2.5">Client</th>
              <th className="text-left font-normal px-4 py-2.5 w-24">Date</th>
              <th className="text-left font-normal px-4 py-2.5 w-[140px]">Timestamp</th>
              <th className="text-right font-normal px-4 py-2.5 w-20">Gap</th>
              <th className="text-right font-normal px-4 py-2.5 w-28">Limit</th>
              <th className="text-center font-normal px-4 py-2.5 w-20">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ finding, entry, userLabel, clientName }) => (
              <tr
                key={entry.id}
                className="border-b border-border last:border-b-0 row-hover cursor-pointer"
                onClick={() => onSelectEntry?.(entry.id)}
                onKeyDown={(e) => e.key === 'Enter' && onSelectEntry?.(entry.id)}
                tabIndex={onSelectEntry ? 0 : undefined}
                role={onSelectEntry ? 'button' : undefined}
              >
                <td className="px-4 py-2.5 font-medium text-ink truncate max-w-[140px]">{userLabel}</td>
                <td className="px-4 py-2.5 text-ink truncate max-w-[180px]" title={clientName}>
                  {clientName}
                </td>
                <td className="px-4 py-2.5 text-muted2 tabular-nums text-[12px]">{entry.work_date}</td>
                <td className="px-4 py-2.5 text-muted2 tabular-nums text-[12px] whitespace-nowrap">
                  {fmtDateTime(entry.created_at)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-ink">
                  {finding.gapMinutes} min
                </td>
                <td className="px-4 py-2.5 text-right text-[12px] text-muted2 tabular-nums">
                  {finding.review === 'slow'
                    ? `max ${finding.expectedMaxMinutes} min`
                    : `min ${finding.expectedMinMinutes} min`}
                  <span className="block text-[10px]">({finding.previousInvoiceCount} inv. prior)</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {finding.review === 'slow' ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-accent2/15 text-accent2 border-accent2/30">
                      Slow
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-yellow/15 text-yellow border-yellow/30">
                      Fast
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

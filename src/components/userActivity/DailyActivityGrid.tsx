import type { DailyActivityRow } from '@/lib/userActivityStats';

function dayHeader(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return iso.slice(5);
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

function cellClass(batches: number): string {
  if (batches === 0) return 'bg-transparent text-muted2/40';
  if (batches === 1) return 'bg-accent/20 text-accent';
  if (batches === 2) return 'bg-accent/35 text-ink';
  return 'bg-accent/55 text-ink';
}

function hasActivity(cell: { batches: number; invoices: number }): boolean {
  return cell.batches > 0 || cell.invoices > 0;
}

interface DailyActivityGridProps {
  rows: DailyActivityRow[];
  onSelectUser?: (userId: string) => void;
}

/** User × weekday (Mon–Fri) batches and invoices for the selected range. */
export function DailyActivityGrid({ rows, onSelectUser }: DailyActivityGridProps) {
  if (rows.length === 0) return null;
  const dates = rows[0]?.days.map((d) => d.date) ?? [];

  return (
    <div className="panel-surface overflow-hidden">
      <div className="px-4 py-[11px] border-b border-border">
        <span className="text-[11px] font-medium text-ink uppercase tracking-[0.04em]">
          Daily log
        </span>
        <p className="text-[11px] text-muted2 mt-0.5">
          Batches and invoices per person (Mon–Fri) — top number is batches, bottom is invoices
        </p>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse text-[11px] min-w-[360px]">
          <thead>
            <tr>
              <th className="text-left font-normal text-label uppercase tracking-wider py-1 pr-2 sticky left-0 bg-panel z-[1]">
                Member
              </th>
              {dates.map((iso) => (
                <th
                  key={iso}
                  className="font-normal text-label text-center py-1 px-0.5 min-w-[40px]"
                  title={iso}
                >
                  {dayHeader(iso)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-t border-border/60">
                <td className="py-1.5 pr-2 sticky left-0 bg-panel z-[1]">
                  {onSelectUser ? (
                    <button
                      type="button"
                      onClick={() => onSelectUser(row.userId)}
                      className="text-ink font-medium truncate max-w-[100px] hover:text-accent text-left"
                    >
                      {row.label}
                    </button>
                  ) : (
                    <span className="text-ink font-medium truncate max-w-[100px] block">{row.label}</span>
                  )}
                </td>
                {row.days.map((cell) => (
                  <td key={cell.date} className="p-0.5 text-center align-middle">
                    <span
                      className={`inline-flex flex-col items-center justify-center min-w-[36px] min-h-[32px] rounded px-0.5 tabular-nums leading-tight ${cellClass(cell.batches)}`}
                      title={
                        hasActivity(cell)
                          ? `${cell.batches} batch${cell.batches !== 1 ? 'es' : ''}, ${cell.invoices} invoice${cell.invoices !== 1 ? 's' : ''} on ${cell.date}`
                          : `No activity on ${cell.date}`
                      }
                    >
                      {hasActivity(cell) ? (
                        <>
                          <span className="text-[10px] font-semibold">{cell.batches}</span>
                          <span className="text-[9px] font-medium opacity-80">{cell.invoices}</span>
                        </>
                      ) : (
                        <span className="text-[10px]">·</span>
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

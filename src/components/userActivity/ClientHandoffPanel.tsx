import type { UserActivityByClient } from '@/lib/userActivityStats';

interface ClientHandoffPanelProps {
  clients: UserActivityByClient[];
  max?: number;
}

/** Which clients were worked and by whom (shared / handoff visibility). */
export function ClientHandoffPanel({ clients, max = 8 }: ClientHandoffPanelProps) {
  if (clients.length === 0) return null;
  const list = clients.slice(0, max);
  const maxBatches = list[0]?.batches ?? 1;

  return (
    <div className="panel-surface p-4 h-full flex flex-col">
      <h3 className="text-[11px] font-medium text-ink uppercase tracking-[0.04em] mb-1">
        Client coverage
      </h3>
      <p className="text-[11px] text-muted2 mb-3">Who touched each client in this range</p>
      <ul className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1">
        {list.map((c) => (
          <li key={c.name}>
            <div className="flex justify-between gap-2 text-[12px] mb-1">
              <span className="text-ink font-medium truncate" title={c.name}>
                {c.name}
              </span>
              <span className="text-muted2 tabular-nums flex-shrink-0">
                {c.batches} · {c.invoices} inv.
              </span>
            </div>
            <div className="h-1 rounded-full bg-border overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-accent/60 transition-all duration-300"
                style={{ width: `${Math.max(6, (c.batches / maxBatches) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted2 truncate" title={c.userLabels.join(', ')}>
              {c.userLabels.length > 0 ? c.userLabels.join(' · ') : '—'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

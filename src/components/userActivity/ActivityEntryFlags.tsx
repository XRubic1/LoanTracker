import type { WorksheetEntryFlag } from '@/lib/worksheetUtils';

const FLAG_STYLES: Record<
  WorksheetEntryFlag['type'],
  string
> = {
  unknown: 'bg-accent/15 text-accent border-accent/25',
  unverified: 'bg-red/10 text-red border-red/25',
  warning: 'bg-tag-overdue/80 text-tag-overdue-fg border-red/25',
  cancellation: 'bg-alert-warn text-alert-warn-fg border-accent/30',
  new_client: 'bg-amber/15 text-amber border-amber/30',
  group: 'bg-surface border-border text-muted2',
};

interface ActivityEntryFlagsProps {
  flags: WorksheetEntryFlag[];
  /** Hide neutral tags (e.g. group work) when nothing needs attention. */
  hideNeutralWhenClean?: boolean;
}

/** Compact flag chips for activity audit rows. */
export function ActivityEntryFlags({ flags, hideNeutralWhenClean }: ActivityEntryFlagsProps) {
  const visible =
    hideNeutralWhenClean && !flags.some((f) => f.type !== 'group')
      ? flags.filter((f) => f.type !== 'group')
      : flags;

  if (visible.length === 0) {
    return <span className="text-muted2 text-[12px]">—</span>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-1 max-w-[220px] mx-auto">
      {visible.map((f) => (
        <span
          key={`${f.type}-${f.label}`}
          title={f.title}
          className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border leading-tight ${FLAG_STYLES[f.type]}`}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}

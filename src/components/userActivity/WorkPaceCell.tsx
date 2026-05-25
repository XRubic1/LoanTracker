import type { WorkDurationFinding } from '@/lib/worksheetTiming';

interface WorkPaceCellProps {
  finding: WorkDurationFinding | undefined;
}

/** Compact single-line pace chip for use inside the batch log table. */
export function WorkPaceCell({ finding }: WorkPaceCellProps) {
  if (!finding) {
    return <span className="text-muted2/50 text-[12px]">—</span>;
  }

  if (finding.review === 'slow') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border bg-accent2/15 text-accent2 border-accent2/30 tabular-nums"
        title={`${finding.gapMinutes} min gap (max ${finding.expectedMaxMinutes} min for ${finding.previousInvoiceCount} invoices)`}
      >
        {finding.gapMinutes} min · Slow
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded border bg-yellow/15 text-yellow border-yellow/30 tabular-nums"
      title={`${finding.gapMinutes} min gap (min ${finding.expectedMinMinutes} min for ${finding.previousInvoiceCount} invoices)`}
    >
      {finding.gapMinutes} min · Fast
    </span>
  );
}

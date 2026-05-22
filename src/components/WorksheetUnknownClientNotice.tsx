import { WORKSHEET_UNKNOWN_CLIENT_MESSAGE } from '@/lib/worksheetUtils';

/** Banner when worksheet client name is not on the registry. */
export function WorksheetUnknownClientNotice({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      className={`rounded-lg border-2 border-accent/45 bg-accent/10 px-3 py-2.5 text-[12px] text-ink leading-snug ${className}`}
    >
      <p className="font-semibold text-accent mb-0.5">Client not on list</p>
      <p>{WORKSHEET_UNKNOWN_CLIENT_MESSAGE}</p>
    </div>
  );
}

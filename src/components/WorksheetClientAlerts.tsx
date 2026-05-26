import type { Client, ClientInsurance } from '@/types';
import {
  getWorksheetClientAlerts,
  type WorksheetClientAlertInfo,
} from '@/lib/worksheetUtils';

interface WorksheetClientAlertsProps {
  client: Client;
  insurance: ClientInsurance | null;
  /** Compact single-line hints for table cells. */
  variant?: 'banner' | 'compact';
  alerts?: WorksheetClientAlertInfo;
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Prominent client warning + insurance cancellation alerts for worksheet. */
export function WorksheetClientAlerts({
  client,
  insurance,
  variant = 'banner',
  alerts: alertsProp,
}: WorksheetClientAlertsProps) {
  const alerts = alertsProp ?? getWorksheetClientAlerts(client, insurance);
  const showWarning = Boolean(alerts.warningNote);
  const showFullVerification = Boolean(alerts.fullVerificationMessage);
  const showAlwaysVerify = Boolean(alerts.alwaysVerifyMessage);
  if (!showWarning && !showFullVerification && !showAlwaysVerify) return null;

  if (variant === 'compact') {
    return (
      <div className="space-y-1.5 min-w-0 text-center mx-auto max-w-[260px]">
        {alerts.warningNote && (
          <p
            className="text-[11px] font-medium text-tag-overdue-fg bg-tag-overdue/80 border border-red/25 rounded px-2 py-1 leading-snug"
            title={alerts.warningNote}
          >
            {alerts.warningNote}
          </p>
        )}
        {showFullVerification && (
          <p
            className="text-[11px] font-medium text-alert-warn-fg bg-alert-warn border border-red/30 rounded px-2 py-1 leading-snug"
            title={alerts.fullVerificationMessage ?? undefined}
          >
            {alerts.fullVerificationMessage}
          </p>
        )}
        {showAlwaysVerify && (
          <p className="text-[11px] font-semibold text-accent bg-accent/10 border border-accent/30 rounded px-2 py-1 leading-snug">
            Full Verification
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      {alerts.warningNote && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border-2 border-red/35 bg-tag-overdue px-3 py-3 shadow-sm"
        >
          <WarningIcon className="w-5 h-5 flex-shrink-0 text-tag-overdue-fg mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tag-overdue-fg mb-1">
              Client warning
            </p>
            <p className="text-[13px] font-medium text-ink leading-snug">{alerts.warningNote}</p>
          </div>
        </div>
      )}
      {showFullVerification && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border-2 border-accent/50 bg-accent/10 px-3 py-3 shadow-sm"
        >
          <WarningIcon className="w-5 h-5 flex-shrink-0 text-accent mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-1">
              Full verification required
            </p>
            <p className="text-[13px] font-medium text-ink leading-snug">{alerts.fullVerificationMessage}</p>
          </div>
        </div>
      )}
      {showAlwaysVerify && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border-2 border-accent/40 bg-accent/5 px-3 py-3 shadow-sm"
        >
          <WarningIcon className="w-5 h-5 flex-shrink-0 text-accent mt-0.5" />
          <p className="text-[14px] font-semibold text-ink leading-snug">Full Verification</p>
        </div>
      )}
    </div>
  );
}

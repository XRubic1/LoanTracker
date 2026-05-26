import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const storageKey = (companyId: number) => `opsdesk_team_admin_welcome_${companyId}`;

/** One-time welcome for team admins after claiming a provisioned company. */
export function TeamAdminWelcome({ onGoToUsers }: { onGoToUsers?: () => void }) {
  const { userRole, company } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (!company) return true;
    try {
      return localStorage.getItem(storageKey(company.id)) === '1';
    } catch {
      return false;
    }
  });

  if (userRole !== 'team_admin' || !company || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(company.id), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="mb-5 rounded-xl border border-accent/25 bg-accent/5 px-4 py-4 animate-fade-in">
      <p className="text-[14px] font-medium text-ink mb-1">Welcome to {company.name}</p>
      <p className="text-[13px] text-muted2 mb-3">
        Your workspace is ready. Invite team members under Users and choose which tabs they can
        access. New members start with Loans only until you grant more access.
      </p>
      <div className="flex flex-wrap gap-2">
        {onGoToUsers && (
          <button type="button" onClick={onGoToUsers} className="btn-primary text-[12px] py-1.5 px-3">
            Go to Users
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="text-[12px] py-1.5 px-3 rounded-lg border border-border text-muted2 hover:text-ink"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

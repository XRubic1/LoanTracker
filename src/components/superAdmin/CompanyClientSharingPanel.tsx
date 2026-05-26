import { useState } from 'react';
import {
  linkCompaniesForClientSharing,
  linkOwnerEmailToCompanyClientSharing,
  unlinkCompanyClientSharing,
  unlinkOwnerFromCompanyClientSharing,
} from '@/lib/supabase-db';
import type { CompanyAdminRow } from '@/types';

interface CompanyClientSharingPanelProps {
  company: CompanyAdminRow;
  allCompanies: CompanyAdminRow[];
  onUpdated: () => void;
}

/** Super admin: link company accounts so they share clients on worksheets. */
export function CompanyClientSharingPanel({
  company,
  allCompanies,
  onUpdated,
}: CompanyClientSharingPanelProps) {
  const [linkCompanyId, setLinkCompanyId] = useState<string>('');
  const [linkEmail, setLinkEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const linkable = allCompanies.filter(
    (c) =>
      c.id !== company.id &&
      c.owner_id != null &&
      c.status === 'active' &&
      !company.linkedCompanies.some((l) => l.companyId === c.id)
  );

  const canLink = company.owner_id != null && company.status === 'active';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setLocalError(null);
    try {
      await fn();
      onUpdated();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!canLink) {
    return (
      <p className="text-[12px] text-muted2 py-2">
        Client sharing is available after the team admin signs up and claims this company.
      </p>
    );
  }

  return (
    <div className="py-3 px-4 bg-surface/40 border-t border-border space-y-3">
      <div>
        <p className="text-[12px] font-medium text-ink mb-1">Link accounts</p>
        <p className="text-[11px] text-muted2">
          Linked teams share worksheet clients, loans, and insurance (read-only across teams; each
          team can filter by team name on those pages). All super-admin companies already share the
          Clients list.
        </p>
      </div>

      {localError && (
        <p className="text-[12px] text-red">{localError}</p>
      )}

      {company.linkedCompanies.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {company.linkedCompanies.map((l) => (
            <li
              key={l.ownerId}
              className="inline-flex items-center gap-2 text-[12px] px-2.5 py-1 rounded-full border border-accent/25 bg-accent/10 text-ink"
            >
              <span>{l.companyName}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    unlinkOwnerFromCompanyClientSharing(company.id, l.ownerId)
                  )
                }
                className="text-muted2 hover:text-red"
                title="Unlink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-muted2">No linked accounts yet.</p>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Link company
          </label>
          <select
            value={linkCompanyId}
            onChange={(e) => setLinkCompanyId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink"
          >
            <option value="">Select company…</option>
            {linkable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !linkCompanyId}
          onClick={() =>
            void run(() =>
              linkCompaniesForClientSharing(company.id, Number(linkCompanyId))
            )
          }
          className="py-1.5 px-3 rounded-md border border-border text-[12px] hover:border-accent disabled:opacity-50"
        >
          Link
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Or link by account email
          </label>
          <input
            type="email"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            placeholder="other-team@example.com"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-ink"
          />
        </div>
        <button
          type="button"
          disabled={busy || !linkEmail.trim()}
          onClick={() =>
            void run(async () => {
              await linkOwnerEmailToCompanyClientSharing(company.id, linkEmail);
              setLinkEmail('');
            })
          }
          className="py-1.5 px-3 rounded-md border border-border text-[12px] hover:border-accent disabled:opacity-50"
        >
          Link email
        </button>
      </div>

      {company.clientShareGroupId != null && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Remove all client sharing for "${company.name}"?`)) return;
            void run(() => unlinkCompanyClientSharing(company.id));
          }}
          className="text-[12px] text-muted2 hover:text-red"
        >
          Unlink this company from all shared groups
        </button>
      )}
    </div>
  );
}

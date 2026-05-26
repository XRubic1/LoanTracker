import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  createCompanyWithTeamAdminInvite,
  fetchCompaniesForAdmin,
  updateCompanyStatus,
} from '@/lib/supabase-db';
import { CompanyClientSharingPanel } from '@/components/superAdmin/CompanyClientSharingPanel';
import type { CompanyAdminRow, CompanyStatus } from '@/types';

interface CompaniesTabProps {
  createdBy?: string | null;
}

export function CompaniesTab({ createdBy }: CompaniesTabProps) {
  const [rows, setRows] = useState<CompanyAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCompaniesForAdmin());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createCompanyWithTeamAdminInvite(name, adminEmail, createdBy);
      setName('');
      setAdminEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (row: CompanyAdminRow) => {
    const next: CompanyStatus = row.status === 'active' ? 'suspended' : 'active';
    if (
      next === 'suspended' &&
      !window.confirm(`Suspend "${row.name}"? Team users will not be able to edit data.`)
    ) {
      return;
    }
    try {
      await updateCompanyStatus(row.id, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted2 text-[13px] max-w-2xl">
        Create companies and invite team admins. Link accounts on a company row so they share the
        same client list on the Worksheet tab.
      </p>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[13px] text-red">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="panel-surface px-4 py-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Company name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Logistics"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Team admin email
          </label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@acme.com"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">
          {creating ? 'Creating…' : 'Create company'}
        </button>
      </form>

      {loading ? (
        <p className="text-muted2 text-[13px]">Loading companies…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted2 text-[13px]">No companies yet.</p>
      ) : (
        <div className="panel-surface overflow-hidden">
          <table className="w-full border-collapse text-[13px] min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
                <th className="text-left font-normal px-4 py-2.5 w-8" />
                <th className="text-left font-normal px-4 py-2.5">Company</th>
                <th className="text-left font-normal px-4 py-2.5">Team admin</th>
                <th className="text-left font-normal px-4 py-2.5 min-w-[140px]">Shared clients</th>
                <th className="text-center font-normal px-4 py-2.5 w-20">Status</th>
                <th className="text-right font-normal px-4 py-2.5 w-16">Members</th>
                <th className="text-right font-normal px-4 py-2.5 w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`border-b border-border row-hover ${expanded ? 'bg-surface/30' : ''}`}
                    >
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                          className="text-muted2 hover:text-ink w-6 h-6 rounded border border-border text-[14px] leading-none"
                          aria-expanded={expanded}
                          title="Link accounts / shared clients"
                        >
                          {expanded ? '−' : '+'}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                      <td className="px-4 py-3 text-[12px] text-muted2">
                        {r.owner_id
                          ? 'Active account'
                          : r.teamAdminPending
                            ? `Pending: ${r.teamAdminEmail}`
                            : r.teamAdminEmail ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.linkedCompanies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.linkedCompanies.map((l) => (
                              <span
                                key={l.ownerId}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-ink border border-accent/20"
                              >
                                {l.companyName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted2">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                            r.status === 'active'
                              ? 'bg-green/15 text-green'
                              : 'bg-accent/15 text-accent'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.memberCount}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void toggleStatus(r)}
                          className="text-[12px] text-accent hover:underline"
                        >
                          {r.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${r.id}-detail`} className="border-b border-border">
                        <td colSpan={7} className="p-0">
                          <CompanyClientSharingPanel
                            company={r}
                            allCompanies={rows}
                            onUpdated={() => void load()}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

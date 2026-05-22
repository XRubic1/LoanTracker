import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberAllowedPages,
} from '@/lib/supabase-db';
import { TeamMemberTabsModal } from '@/components/modals/TeamMemberTabsModal';
import { ASSIGNABLE_PAGE_IDS, PAGE_LABELS, normalizeAllowedPages } from '@/lib/tabPermissions';
import type { PageId, TeamMember } from '@/types';

function tabsSummary(allowed: PageId[] | null): string {
  const pages = normalizeAllowedPages(allowed);
  if (pages.length >= ASSIGNABLE_PAGE_IDS.length) return 'All tabs';
  if (pages.length === 0) return 'No tabs';
  return pages.map((p) => PAGE_LABELS[p]).join(', ');
}

export function UsersPage() {
  const { effectiveOwnerId, isOwner } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [tabsMember, setTabsMember] = useState<TeamMember | null>(null);
  const [savingTabs, setSavingTabs] = useState(false);

  const load = useCallback(async () => {
    if (!effectiveOwnerId || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamMembers(effectiveOwnerId);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [effectiveOwnerId, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !effectiveOwnerId) return;
    setAdding(true);
    setError(null);
    try {
      await addTeamMember(effectiveOwnerId, trimmed);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    if (!effectiveOwnerId || !window.confirm(`Remove ${memberEmail} from your team?`)) return;
    setRemoving(memberEmail);
    try {
      await removeTeamMember(effectiveOwnerId, memberEmail);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(null);
    }
  };

  const handleSaveTabs = async (pages: PageId[]) => {
    if (!effectiveOwnerId || !tabsMember) return;
    setSavingTabs(true);
    setError(null);
    try {
      await updateTeamMemberAllowedPages(effectiveOwnerId, tabsMember.email, pages);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setSavingTabs(false);
    }
  };

  if (!isOwner) {
    return (
      <div>
        <h1 className="page-title mb-3">Users</h1>
        <p className="text-muted2">
          You’re viewing this dashboard as a team member. Only the account owner can manage users.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users</h1>
      </div>

      <p className="text-muted2 text-sm mb-3">
        Add users by email. When they sign up with that email, they’ll see your data on the tabs you
        allow. Use <strong className="text-ink font-medium">Manage tabs</strong> to control which
        pages each person can open.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-3 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="flex-1 min-w-[200px] bg-surface border border-border text-ink py-2 px-3 rounded-lg text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={adding || !email.trim()}
          className="btn-primary py-2 px-4 rounded-lg text-sm disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add user'}
        </button>
      </form>

      {error && (
        <div className="mb-4 py-2 px-3 rounded-lg text-sm text-tag-overdue-fg bg-tag-overdue border border-red/20">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted2 text-sm">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-muted text-sm">No team members yet. Add someone by email above.</p>
      ) : (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10px] text-label uppercase tracking-widest py-3 px-4 text-left border-b border-border">
                  Email
                </th>
                <th className="text-[10px] text-label uppercase tracking-widest py-3 px-4 text-left border-b border-border">
                  Status
                </th>
                <th className="text-[10px] text-label uppercase tracking-widest py-3 px-4 text-left border-b border-border">
                  Tabs
                </th>
                <th className="text-[10px] text-label uppercase tracking-widest py-3 px-4 text-left border-b border-border w-40">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={`${m.owner_id}-${m.email}`} className="row-hover">
                  <td className="py-3 px-4 border-b border-divider text-sm">{m.email}</td>
                  <td className="py-3 px-4 border-b border-divider">
                    <span
                      className={`inline-flex items-center py-0.5 px-2 rounded-full text-xs font-medium ${
                        m.member_id
                          ? 'bg-green/10 text-green'
                          : 'bg-alert-warn text-alert-warn-fg'
                      }`}
                    >
                      {m.member_id ? 'Active' : 'Pending invite'}
                    </span>
                  </td>
                  <td className="py-3 px-4 border-b border-divider text-sm text-muted2 max-w-[240px] truncate" title={tabsSummary(m.allowed_pages)}>
                    {tabsSummary(m.allowed_pages)}
                  </td>
                  <td className="py-3 px-4 border-b border-divider">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setTabsMember(m)}
                        className="text-accent hover:text-accent/80 text-sm"
                      >
                        Manage tabs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(m.email)}
                        disabled={removing === m.email}
                        className="text-muted hover:text-red text-sm disabled:opacity-50"
                      >
                        {removing === m.email ? '…' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeamMemberTabsModal
        open={tabsMember != null}
        onClose={() => setTabsMember(null)}
        memberEmail={tabsMember?.email ?? ''}
        allowedPages={tabsMember?.allowed_pages ?? null}
        saving={savingTabs}
        onSave={handleSaveTabs}
      />
    </div>
  );
}

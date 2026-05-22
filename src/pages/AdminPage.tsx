import { useCallback, useEffect, useState } from 'react';
import {
  fetchCompanyGroups,
  createCompanyGroup,
  deleteCompanyGroup,
  addOwnerToCompanyGroup,
  removeOwnerFromCompanyGroup,
  lookupOwnerIdByEmail,
} from '@/lib/supabase-db';
import type { OwnerCompanyGroup } from '@/types';

export function AdminPage() {
  const [groups, setGroups] = useState<OwnerCompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [memberEmail, setMemberEmail] = useState<Record<number, string>>({});
  const [addingMember, setAddingMember] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanyGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    setAddingGroup(true);
    try {
      await createCompanyGroup(name);
      setNewGroupName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: number, name: string) => {
    if (!window.confirm(`Delete company group "${name}"?`)) return;
    try {
      await deleteCompanyGroup(groupId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddMember = async (groupId: number) => {
    const email = (memberEmail[groupId] ?? '').trim();
    if (!email) return;
    setAddingMember(groupId);
    setError(null);
    try {
      const ownerId = await lookupOwnerIdByEmail(email);
      if (!ownerId) {
        setError(`No account found for ${email}`);
        return;
      }
      await addOwnerToCompanyGroup(groupId, ownerId);
      setMemberEmail((prev) => ({ ...prev, [groupId]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingMember(null);
    }
  };

  const handleRemoveMember = async (groupId: number, ownerId: string) => {
    try {
      await removeOwnerFromCompanyGroup(groupId, ownerId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin — Company linking</h1>
      </div>

      <p className="text-muted2 text-[13px] mb-6 max-w-2xl">
        Connect multiple team accounts (e.g. Team 1 and Team 2) so members can see each other&apos;s client
        lists when logging worksheet batches. Only platform admins can manage these links.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[13px] text-red">
          {error}
        </div>
      )}

      <form onSubmit={handleCreateGroup} className="mb-8 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">New group name</label>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. AAA Team 1 + Team 2"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <button type="submit" disabled={addingGroup} className="btn-primary disabled:opacity-50">
          {addingGroup ? 'Creating…' : 'Create group'}
        </button>
      </form>

      {loading ? (
        <p className="text-muted2 text-[13px]">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-muted2 text-[13px]">No company groups yet.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-panel p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-[15px] font-medium text-ink">{g.name}</h2>
                <button
                  type="button"
                  onClick={() => void handleDeleteGroup(g.id, g.name)}
                  className="text-xs text-red hover:underline"
                >
                  Delete group
                </button>
              </div>
              <ul className="text-[13px] space-y-2 mb-4">
                {(g.members ?? []).length === 0 ? (
                  <li className="text-muted2">No owners linked yet.</li>
                ) : (
                  (g.members ?? []).map((m) => (
                    <li key={m.owner_id} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] text-muted2">{m.owner_id}</span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(g.id, m.owner_id)}
                        className="text-xs text-muted2 hover:text-red"
                      >
                        Remove
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  placeholder="Owner account email"
                  value={memberEmail[g.id] ?? ''}
                  onChange={(e) =>
                    setMemberEmail((prev) => ({ ...prev, [g.id]: e.target.value }))
                  }
                  className="flex-1 min-w-[180px] rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-ink"
                />
                <button
                  type="button"
                  onClick={() => void handleAddMember(g.id)}
                  disabled={addingMember === g.id}
                  className="py-2 px-3 rounded-lg border border-border text-sm hover:border-accent disabled:opacity-50"
                >
                  {addingMember === g.id ? 'Adding…' : 'Add owner'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTeamMembers, addTeamMember, removeTeamMember } from '@/lib/supabase-db';
import type { TeamMember } from '@/types';

export function UsersPage() {
  const { effectiveOwnerId, isOwner } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

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

  if (!isOwner) {
    return (
      <div className="py-7 px-8">
        <h1 className="text-[22px] font-semibold mb-4">Users</h1>
        <p className="text-muted2">
          You’re viewing this dashboard as a team member. Only the account owner can manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="py-7 px-8">
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-semibold">Users</h1>
      </div>

      <p className="text-muted2 text-sm mb-6">
        Add users by email. When they sign up with that email, they’ll see your loans and reserves and can interact with payments.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="flex-1 min-w-[200px] bg-surface border border-border text-text py-2 px-3 rounded-lg text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={adding || !email.trim()}
          className="py-2 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-[#3a7de8] disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add user'}
        </button>
      </form>

      {error && (
        <div className="mb-4 py-2 px-3 rounded-lg text-sm text-red bg-red/10 border border-red/20">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted2 text-sm">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-muted text-sm">No team members yet. Add someone by email above.</p>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-[10px] text-muted uppercase tracking-widest py-3 px-4 text-left border-b border-border">
                  Email
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-3 px-4 text-left border-b border-border">
                  Status
                </th>
                <th className="text-[10px] text-muted uppercase tracking-widest py-3 px-4 text-left border-b border-border w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={`${m.owner_id}-${m.email}`} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 border-b border-border/40 text-sm">{m.email}</td>
                  <td className="py-3 px-4 border-b border-border/40">
                    <span
                      className={`inline-flex items-center py-0.5 px-2 rounded-full text-xs font-medium ${
                        m.member_id
                          ? 'bg-green/10 text-green'
                          : 'bg-yellow/10 text-yellow'
                      }`}
                    >
                      {m.member_id ? 'Active' : 'Pending invite'}
                    </span>
                  </td>
                  <td className="py-3 px-4 border-b border-border/40">
                    <button
                      type="button"
                      onClick={() => handleRemove(m.email)}
                      disabled={removing === m.email}
                      className="text-muted hover:text-red text-sm disabled:opacity-50"
                    >
                      {removing === m.email ? '…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

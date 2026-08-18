import { useCallback, useEffect, useState } from 'react';
import {
  addPlatformAdmin,
  fetchPlatformAdmins,
  removePlatformAdmin,
} from '@/lib/supabase-db';
import { isPlatformAdminEnv, isProtectedPlatformAdmin } from '@/lib/platformAdmin';
import { useAuth } from '@/contexts/AuthContext';
import type { PlatformAdmin } from '@/types';

/** Grant/revoke platform super-admin emails (platform_admins table). */
export function PlatformAdminsTab() {
  const { user, isPlatformAdmin, refreshProfile } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const canManage = isPlatformAdmin || isPlatformAdminEnv(user?.email);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAdmins(await fetchPlatformAdmins());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addPlatformAdmin(newEmail);
      setNewEmail('');
      await load();
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    const self = user?.email?.trim().toLowerCase();
    if (email === self) {
      setError('You cannot remove your own super-admin access here.');
      return;
    }
    if (isProtectedPlatformAdmin(email, admins)) {
      setError('The primary super-admin email cannot be removed.');
      return;
    }
    if (!window.confirm(`Remove super-admin access for ${email}?`)) return;
    setError(null);
    try {
      await removePlatformAdmin(email);
      await load();
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-border bg-panel px-4 py-8 text-center">
        <p className="text-[13px] text-muted2">
          You need super-admin access to manage platform admins. Seed your email in{' '}
          <code className="text-[12px] text-ink">platform_admins</code> via SQL, or add it to{' '}
          <code className="text-[12px] text-ink">VITE_PLATFORM_ADMIN_EMAILS</code> in{' '}
          <code className="text-[12px] text-ink">.env</code> for local dev.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-[13px] text-ink">
        Super admins can access this console, create companies, and view all tenants. Add their
        email here first — they can then create an account with that same address (no company invite
        needed).
      </div>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[13px] text-red">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => void handleAdd(e)}
        className="panel-surface px-4 py-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            Add super admin
          </label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="admin@example.com"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <button type="submit" disabled={adding} className="btn-primary disabled:opacity-50">
          {adding ? 'Adding…' : 'Grant access'}
        </button>
      </form>

      {loading ? (
        <p className="text-muted2 text-[13px]">Loading…</p>
      ) : (
        <div className="panel-surface overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-[10px] uppercase tracking-wider text-label">
                <th className="text-left font-normal px-4 py-2.5">Email</th>
                <th className="text-left font-normal px-4 py-2.5 w-40">Added</th>
                <th className="text-right font-normal px-4 py-2.5 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = a.email === user?.email?.trim().toLowerCase();
                const isPrimary = isProtectedPlatformAdmin(a.email, admins);
                const canRemove = !isSelf && !isPrimary;
                return (
                  <tr key={a.email} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {a.email}
                      {isPrimary && (
                        <span className="ml-2 text-[11px] text-muted2 font-normal">(primary)</span>
                      )}
                      {isSelf && (
                        <span className="ml-2 text-[11px] text-muted2 font-normal">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted2">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => void handleRemove(a.email)}
                          className="text-[12px] text-red hover:underline"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted2">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {admins.length === 0 && (
            <p className="text-muted2 text-[13px] py-8 text-center">No super admins in database yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

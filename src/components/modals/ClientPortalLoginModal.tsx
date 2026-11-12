import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { deletePortalAccount, savePortalAccount, type PortalAccount } from '@/lib/portalUpload';

interface ClientPortalLoginModalProps {
  open: boolean;
  clientId: number;
  clientName: string;
  /** The saved login for this client, if there is one. */
  account: PortalAccount | null;
  /** Only the account owner may change logins. */
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent';
const labelClass = 'mb-1 block text-[10px] font-medium uppercase tracking-widest text-label';

/** Set, change or remove the TruFunding portal login for one client. */
export function ClientPortalLoginModal({
  open,
  clientId,
  clientName,
  account,
  canManage,
  onClose,
  onChanged,
}: ClientPortalLoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername(account?.username ?? '');
    setPassword('');
    setError(null);
  }, [open, account]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await savePortalAccount({
        id: account?.id,
        client_id: clientId,
        label: clientName,
        username,
        password: password || undefined,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!account || !window.confirm(`Remove the portal login for ${clientName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deletePortalAccount(account.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={`Portal login · ${clientName}`}>
      {canManage ? (
        <div className="space-y-3">
          <p className="text-[12px] text-muted">
            Their TruFunding client portal login. It is tested on the portal when you save. The password is stored
            encrypted and is never shown again.
          </p>
          <div>
            <label className={labelClass}>Portal username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Portal password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={account ? 'Leave blank to keep' : ''}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-red">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            {account ? (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="text-xs text-muted hover:text-red disabled:opacity-50"
              >
                Remove login
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || !username.trim() || (!account && !password)}
                className="rounded-lg btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
              >
                {busy ? 'Testing login…' : 'Save login'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted2">
          {account
            ? `A portal login is saved for ${clientName} (${account.username}).`
            : `No portal login is saved for ${clientName}.`}{' '}
          Only the account owner can change it.
        </p>
      )}
    </Modal>
  );
}

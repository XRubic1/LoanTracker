import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo, BrandWordmark } from '@/components/BrandLogo';
import { ThemeToggle } from '@/components/ThemeToggle';

const inputClass =
  'w-full bg-surface border border-border text-ink py-2.5 px-3 rounded-lg text-sm outline-none focus:border-accent';

/** Shown after someone opens a password-reset email link. */
export function SetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: err } = await updatePassword(password);
    if (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-page px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm bg-panel border border-border rounded-xl p-8 shadow-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo size="md" className="mb-3" />
          <BrandWordmark className="text-[1.35rem]" />
        </div>
        <p className="text-muted2 text-sm mb-3">Choose a new password</p>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-xs font-medium text-muted2 mb-1.5">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-xs font-medium text-muted2 mb-1.5">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <div className="text-sm text-tag-overdue-fg bg-tag-overdue border border-red/20 rounded-lg py-2 px-3">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );
}

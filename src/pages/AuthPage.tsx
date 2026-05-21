import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo, BrandWordmark } from '@/components/BrandLogo';

type Mode = 'login' | 'register';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) setError(err.message);
      } else {
        const { error: err } = await signUp(email.trim(), password);
        if (err) setError(err.message);
        else setSuccess('Check your email to confirm your account, then sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-page px-4">
      <div
        key={mode}
        className="w-full max-w-sm bg-panel border border-border rounded-xl p-8 shadow-xl animate-auth-switch"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo size="md" className="mb-3" />
          <BrandWordmark className="text-[1.35rem]" />
        </div>
        <p className="text-muted2 text-sm mb-3">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-muted2 mb-1.5">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border text-ink py-2.5 px-3 rounded-lg text-sm outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-muted2 mb-1.5">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border text-ink py-2.5 px-3 rounded-lg text-sm outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="text-sm text-tag-overdue-fg bg-tag-overdue border border-red/20 rounded-lg py-2 px-3">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green bg-green/10 border border-green/20 rounded-lg py-2 px-3">
              {success}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted2">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
                className="text-accent hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className="text-accent hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

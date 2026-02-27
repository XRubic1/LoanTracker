import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-4">
      <div
        key={mode}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl animate-auth-switch"
      >
        <h1 className="text-xl font-semibold text-text mb-1">Loan Dashboard</h1>
        <p className="text-muted2 text-sm mb-6">
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
              className="w-full bg-surface border border-border text-text py-2.5 px-3 rounded-lg text-sm outline-none focus:border-accent"
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
              className="w-full bg-surface border border-border text-text py-2.5 px-3 rounded-lg text-sm outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="text-sm text-red bg-red/10 border border-red/20 rounded-lg py-2 px-3">
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
            className="w-full py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-[#3a7de8] disabled:opacity-50 transition-colors"
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

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  effectiveOwnerId: string | null;
  isOwner: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Claim any pending invite: set member_id for rows where email matches and member_id is null */
async function claimInvite(supabase: NonNullable<ReturnType<typeof getSupabase>>, userId: string, email: string) {
  const { error } = await supabase
    .from('team_members')
    .update({ member_id: userId })
    .is('member_id', null)
    .eq('email', email);
  if (error) console.warn('Claim invite:', error.message);
}

/** Resolve effective owner: if user is a member, return owner_id; else return user id */
async function resolveEffectiveOwnerId(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('team_members')
    .select('owner_id')
    .eq('member_id', userId)
    .limit(1)
    .maybeSingle();
  return data?.owner_id ?? userId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabase();

  const refreshEffectiveOwner = useCallback(
    async (uid: string) => {
      if (!supabase) return;
      const ownerId = await resolveEffectiveOwnerId(supabase, uid);
      setEffectiveOwnerId(ownerId);
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const setAuthState = async (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      try {
        if (session?.user) {
          await claimInvite(supabase, session.user.id, session.user.email ?? '');
          await refreshEffectiveOwner(session.user.id);
        } else {
          setEffectiveOwnerId(null);
        }
      } finally {
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthState(session);
    });

    // Initial session: resolve once, with timeout so we never hang forever
    const timeoutMs = 10_000;
    const getSessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: Session | null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), timeoutMs)
    );
    Promise.race([getSessionPromise, timeoutPromise])
      .then(async ({ data: { session: s } }) => {
        await setAuthState(s);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setEffectiveOwnerId(null);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [supabase, refreshEffectiveOwner]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: new Error('Supabase not configured') };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ?? null };
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: new Error('Supabase not configured') };
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ?? null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setEffectiveOwnerId(null);
  }, [supabase]);

  const isOwner = user != null && effectiveOwnerId === user.id;

  const value: AuthContextValue = {
    user,
    session,
    effectiveOwnerId,
    isOwner,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

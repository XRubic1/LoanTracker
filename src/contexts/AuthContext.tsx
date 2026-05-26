import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { PageId, UserRole, CompanyContext } from '@/types';
import { getSupabase } from '@/lib/supabase';
import {
  claimCompanyInvites,
  fetchCompanyByOwnerId,
  fetchMyTeamMembership,
} from '@/lib/supabase-db';
import { resolveIsPlatformAdmin } from '@/lib/platformAdmin';
import { DEFAULT_MEMBER_ALLOWED_PAGES, normalizeAllowedPages } from '@/lib/tabPermissions';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  effectiveOwnerId: string | null;
  isOwner: boolean;
  memberAllowedPages: PageId[] | null;
  userRole: UserRole;
  company: CompanyContext | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Claim pending team_members invites by email. */
async function claimInvite(supabase: NonNullable<ReturnType<typeof getSupabase>>, userId: string, email: string) {
  const { error } = await supabase
    .from('team_members')
    .update({ member_id: userId })
    .is('member_id', null)
    .eq('email', email);
  if (error) console.warn('Claim invite:', error.message);
}

/** Resolve effective owner: team member → owner_id; else own user id. */
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

async function resolveUserRole(
  uid: string,
  effectiveOwnerId: string,
  isPlatformAdminFlag: boolean
): Promise<{ role: UserRole; company: CompanyContext | null }> {
  if (isPlatformAdminFlag) {
    const ownCompany = await fetchCompanyByOwnerId(uid);
    if (ownCompany) return { role: 'team_admin', company: ownCompany };
    return { role: 'platform_admin', company: null };
  }
  const ownCompany = await fetchCompanyByOwnerId(uid);
  if (ownCompany && uid === effectiveOwnerId) {
    return { role: 'team_admin', company: ownCompany };
  }
  if (uid !== effectiveOwnerId) {
    const company = await fetchCompanyByOwnerId(effectiveOwnerId);
    return { role: 'team_member', company };
  }
  if (ownCompany) {
    return { role: 'team_admin', company: ownCompany };
  }
  return { role: 'standalone', company: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null);
  const [memberAllowedPages, setMemberAllowedPages] = useState<PageId[] | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('standalone');
  const [company, setCompany] = useState<CompanyContext | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabase();

  const refreshProfile = useCallback(
    async (uid: string, email: string) => {
      if (!supabase) return;
      await claimInvite(supabase, uid, email);
      try {
        await claimCompanyInvites();
      } catch (err) {
        console.warn('Claim company invites:', err);
      }
      const ownerId = await resolveEffectiveOwnerId(supabase, uid);
      setEffectiveOwnerId(ownerId);
      const platformAdmin = await resolveIsPlatformAdmin(email);
      setIsPlatformAdmin(platformAdmin);
      const { role, company: co } = await resolveUserRole(uid, ownerId, platformAdmin);
      setUserRole(role);
      setCompany(co);
      if (ownerId === uid) {
        setMemberAllowedPages(null);
      } else {
        try {
          const membership = await fetchMyTeamMembership(uid);
          setMemberAllowedPages(
            membership?.allowed_pages == null
              ? [...DEFAULT_MEMBER_ALLOWED_PAGES]
              : normalizeAllowedPages(membership.allowed_pages)
          );
        } catch (err) {
          console.warn('Load tab permissions:', err);
          setMemberAllowedPages(['loans']);
        }
      }
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
          await refreshProfile(session.user.id, session.user.email ?? '');
        } else {
          setEffectiveOwnerId(null);
          setMemberAllowedPages(null);
          setUserRole('standalone');
          setCompany(null);
          setIsPlatformAdmin(false);
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
        setMemberAllowedPages(null);
        setUserRole('standalone');
        setCompany(null);
        setIsPlatformAdmin(false);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [supabase, refreshProfile]);

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
    setMemberAllowedPages(null);
    setUserRole('standalone');
    setCompany(null);
    setIsPlatformAdmin(false);
  }, [supabase]);

  const refreshProfilePublic = useCallback(async () => {
    if (!user) return;
    await refreshProfile(user.id, user.email ?? '');
  }, [user, refreshProfile]);

  const isOwner = user != null && effectiveOwnerId === user.id;

  const value: AuthContextValue = {
    user,
    session,
    effectiveOwnerId,
    isOwner,
    memberAllowedPages,
    userRole,
    company,
    isPlatformAdmin,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: refreshProfilePublic,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

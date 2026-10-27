// Powered by OnSpace.AI
import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getSupabaseClient, useAlert } from '@/template';
import { AuthProfile, RegisterMeta, fetchProfile, sendEmailOtp, signInWithPassword, signOut as svcSignOut, verifyOtpAndRegister } from '@/services/authService';
import { withRequestTimeout } from '@/services/requestTimeoutService';
import { isDesignatedAdmin } from '@/services/adminEntryService';

export interface AuthContextType {
  authUser: AuthProfile | null; loading: boolean; operationLoading: boolean; profileError: string;
  isAdmin: boolean; isBusiness: boolean;
  passwordRecovery: boolean; recoveryUserId: string | null;
  beginPasswordRecovery: (userId?: string) => void; endPasswordRecovery: () => void;
  signIn: (email: string, password: string, account?: 'user' | 'business') => Promise<{ error: string | null }>;
  sendOtp: (email: string, meta?: RegisterMeta) => Promise<{ error: string | null }>;
  registerWithOtp: (email: string, otp: string, password: string, meta: RegisterMeta) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>; refreshProfile: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const { showAlert } = useAlert();
  const [authUser, setAuthUser] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const recovering = useRef(false);
  const epoch = useRef(0);
  const alive = useRef(true);
  const operation = useRef(false);
  const signingOut = useRef(false);
  const currentProfile = useRef<AuthProfile | null>(null);
  const pending = useRef<Promise<void> | null>(null);

  const clearIdentity = useCallback(() => {
    epoch.current += 1;
    pending.current = null;
    currentProfile.current = null;
    recovering.current = false;
    if (!alive.current) return;
    setAuthUser(null); setProfileError(''); setLoading(false);
    setPasswordRecovery(false); setRecoveryUserId(null);
  }, []);

  const beginPasswordRecovery = useCallback((userId?: string) => {
    recovering.current = true;
    epoch.current += 1; pending.current = null; currentProfile.current = null;
    setAuthUser(null); setProfileError(''); setLoading(false);
    setPasswordRecovery(true);
    if (userId) setRecoveryUserId(userId);
  }, []);
  const endPasswordRecovery = useCallback(() => {
    recovering.current = false;
    setPasswordRecovery(false); setRecoveryUserId(null); setProfileError('');
  }, []);

  const refreshProfile = useCallback((): Promise<void> => {
    // Recovery sessions are not regular logins and must not hydrate account access.
    if (recovering.current || signingOut.current) return Promise.resolve();
    // Startup, foreground, polling and auth events share a single read.
    if (pending.current) return pending.current;
    const version = ++epoch.current;
    const task = (async () => {
      try {
        const profile = await withRequestTimeout((async () => {
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          const session = data.session;
          return session?.user ? fetchProfile(session.user.id, session.user.email ?? '') : null;
        })(), 'Oturum bilgileri yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.');
        if (!alive.current || version !== epoch.current) return;
        // Preserve object identity when values did not change. Editors and data
        // hooks must not restart merely because a background poll completed.
        if (JSON.stringify(currentProfile.current) !== JSON.stringify(profile)) {
          currentProfile.current = profile;
          setAuthUser(profile);
        }
        setProfileError('');
      } catch (reason) {
        if (!alive.current || version !== epoch.current) return;
        currentProfile.current = null;
        setAuthUser(null);
        setProfileError(reason instanceof Error ? reason.message : 'Oturum bilgileri yüklenemedi.');
      } finally {
        if (alive.current && version === epoch.current) setLoading(false);
      }
    })();
    pending.current = task;
    void task.finally(() => { if (pending.current === task) pending.current = null; });
    return task;
  }, [client]);

  useEffect(() => {
    alive.current = true;
    void refreshProfile();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // Never await Supabase reads in this callback: doing so can deadlock the auth lock.
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        beginPasswordRecovery(session.user.id);
        return;
      }
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        clearIdentity();
        return;
      }
      if (signingOut.current || recovering.current || !session || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      // getUser() in existing business services can emit SIGNED_IN for the
      // current account. It must not trigger a profile/route-check feedback loop.
      if (event === 'SIGNED_IN' && currentProfile.current?.id === session.user.id) return;
      const version = epoch.current;
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!operation.current && alive.current && version === epoch.current) void refreshProfile();
      }, 0);
      timers.add(timer);
    });
    const poll = setInterval(() => {
      if (!operation.current && AppState.currentState === 'active') void refreshProfile();
    }, 30000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active' && !signingOut.current) {
        client.auth.startAutoRefresh();
        if (!operation.current) void refreshProfile();
      } else client.auth.stopAutoRefresh();
    });
    client.auth.startAutoRefresh();
    return () => {
      alive.current = false; epoch.current += 1; pending.current = null;
      subscription.subscription.unsubscribe(); clearInterval(poll);
      timers.forEach(clearTimeout); appState.remove(); client.auth.stopAutoRefresh();
    };
  }, [client, refreshProfile, beginPasswordRecovery, clearIdentity]);

  const run = useCallback(async (task: () => Promise<{ error: string | null }>, refresh: boolean) => {
    if (operation.current) return { error: 'İşlem devam ediyor.' };
    operation.current = true; setOperationLoading(true);
    if (refresh) { epoch.current += 1; pending.current = null; }
    try {
      const result = await task();
      if (refresh) await refreshProfile();
      return result;
    } catch (reason) {
      if (refresh) await refreshProfile();
      return { error: reason instanceof Error ? reason.message : 'Giriş işlemi tamamlanamadı.' };
    } finally {
      operation.current = false;
      if (alive.current) setOperationLoading(false);
    }
  }, [refreshProfile]);
  const signIn = useCallback((email: string, password: string, account?: 'user' | 'business') => run(() => signInWithPassword(email, password, account), true), [run]);
  const sendOtp = useCallback((email: string, meta?: RegisterMeta) => run(() => sendEmailOtp(email, meta), false), [run]);
  const registerWithOtp = useCallback((email: string, otp: string, password: string, meta: RegisterMeta) => run(() => verifyOtpAndRegister(email, otp, password, meta), true), [run]);
  const signOut = useCallback(async (): Promise<{ error: string | null }> => {
    if (operation.current) return { error: 'İşlem devam ediyor. Lütfen bekleyin.' };
    operation.current = true;
    signingOut.current = true;
    epoch.current += 1; pending.current = null;
    if (alive.current) setOperationLoading(true);
    try {
      await client.auth.stopAutoRefresh();
      await svcSignOut();
      // Clear React state only after the SDK credentials are verified removed.
      // Reads started before logout cannot restore an outdated profile.
      clearIdentity();
      return { error: null };
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : 'Tekrar deneyin.';
      if (alive.current) showAlert('Çıkış yapılamadı', error);
      return { error };
    } finally {
      signingOut.current = false;
      operation.current = false;
      if (alive.current) {
        setOperationLoading(false);
        if (AppState.currentState === 'active') client.auth.startAutoRefresh();
      }
    }
  }, [client, clearIdentity, showAlert]);
  const value = useMemo<AuthContextType>(() => ({
    authUser, loading, operationLoading, profileError,
    passwordRecovery, recoveryUserId, beginPasswordRecovery, endPasswordRecovery,
    isAdmin: isDesignatedAdmin(authUser),
    isBusiness: authUser?.role === 'business' && authUser.businessAccess === true,
    signIn, sendOtp, registerWithOtp, signOut, refreshProfile,
  }), [authUser, loading, operationLoading, profileError, passwordRecovery, recoveryUserId, beginPasswordRecovery, endPasswordRecovery, signIn, sendOtp, registerWithOtp, signOut, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';

export function useBusinessApproval() {
  const { authUser, loading, operationLoading, profileError, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await refreshProfile();
      if (mounted.current) setCheckedAt(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      busy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [refreshProfile]);
  const logout = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSigningOut(true);
    try { await signOut(); router.replace('/auth'); }
    finally { busy.current = false; if (mounted.current) setSigningOut(false); }
  }, [signOut, router]);
  return {
    authUser, loading: loading || operationLoading, error: profileError,
    approved: authUser?.businessApproval === 'approved',
    active: authUser?.role === 'business' && authUser.businessAccess === true,
    refreshing, signingOut, checkedAt, refresh, logout,
  };
}

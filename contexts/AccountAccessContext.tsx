import React, { createContext, ReactNode, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface AccountAccess { customer: boolean; checking: boolean; business: boolean; admin: boolean; guest: boolean }
export const AccountAccessContext = createContext<AccountAccess | undefined>(undefined);
export function AccountAccessProvider({ children }: { children: ReactNode }) {
  const { authUser, loading } = useAuth();
  const role = authUser?.role;
  const restriction = authUser?.restricted_until;
  const active = authUser?.status === 'active' && (!restriction || new Date(restriction).getTime() <= Date.now());
  const businessAccess = authUser?.businessAccess === true;
  // UI capabilities use the loaded database profile, not an extra polling RPC.
  // Every write is still authorized by service checks and server-side RLS/RPCs.
  const value = useMemo<AccountAccess>(() => ({
    customer: role === 'user' && active,
    checking: loading,
    business: role === 'business' && active && businessAccess,
    admin: role === 'admin' && active,
    guest: !role,
  }), [role, active, loading, businessAccess]);
  return <AccountAccessContext.Provider value={value}>{children}</AccountAccessContext.Provider>;
}

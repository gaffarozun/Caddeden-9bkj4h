import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
export interface BusinessCartContextType {
  carts: Record<string, Record<string, number>>; revision: number;
  change: (businessId: string, itemId: string, delta: number) => void;
  clear: (businessId: string) => void; invalidate: () => void;
}
export const BusinessCartContext = createContext<BusinessCartContextType | undefined>(undefined);
export function BusinessCartProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const [carts, setCarts] = useState<Record<string, Record<string, number>>>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => { setCarts({}); setRevision(value => value + 1); }, [authUser?.id, authUser?.role]);
  const change = useCallback((businessId: string, itemId: string, delta: number) => {
    if (authUser && (authUser.role !== 'user' || authUser.status !== 'active')) return;
    setCarts(previous => {
      const cart = { ...(previous[businessId] ?? {}) };
      const quantity = Math.max(0, Math.min(99, (cart[itemId] ?? 0) + delta));
      if (quantity === 0) delete cart[itemId]; else cart[itemId] = quantity;
      return { ...previous, [businessId]: cart };
    });
  }, [authUser?.role, authUser?.status]);
  const clear = useCallback((id: string) => setCarts(previous => { const next = { ...previous }; delete next[id]; return next; }), []);
  const invalidate = useCallback(() => setRevision(value => value + 1), []);
  const value = useMemo(() => ({ carts, revision, change, clear, invalidate }), [carts, revision, change, clear, invalidate]);
  return <BusinessCartContext.Provider value={value}>{children}</BusinessCartContext.Provider>;
}

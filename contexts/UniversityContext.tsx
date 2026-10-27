import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchUniversityPublicMessages, UniversityPublicMessage } from '@/services/universityService';
import { useAuth } from '@/hooks/useAuth';

interface UniversityContextValue {
  messages: UniversityPublicMessage[]; loading: boolean; error: string; revision: number;
  refresh: () => Promise<void>; invalidate: () => void; removeFromFeed: (id: string) => void;
}
export const UniversityContext = createContext<UniversityContextValue | undefined>(undefined);
export function UniversityProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const [messages, setMessages] = useState<UniversityPublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const alive = useRef(true);
  const pending = useRef<Promise<void> | null>(null);
  const withdrawnIds = useRef(new Set<string>());
  const refresh = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    const task = (async () => {
      try {
        const result = await fetchUniversityPublicMessages();
        if (!alive.current) return;
        // A response started before withdrawal must not reintroduce a removed subtitle.
        const visible = result.filter(item => !withdrawnIds.current.has(item.id));
        setMessages(previous => JSON.stringify(previous) === JSON.stringify(visible) ? previous : visible);
        setError('');
      } catch (reason) {
        if (alive.current) setError(reason instanceof Error ? reason.message : 'Yazılar yüklenemedi.');
      } finally { if (alive.current) setLoading(false); }
    })();
    pending.current = task;
    void task.finally(() => { if (pending.current === task) pending.current = null; });
    return task;
  }, []);
  const invalidate = useCallback(() => { setRevision(value => value + 1); }, []);
  const removeFromFeed = useCallback((id: string) => {
    withdrawnIds.current.add(id);
    setMessages(previous => previous.filter(item => item.id !== id));
    setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive.current = false; clearInterval(timer); subscription.remove(); };
  }, [refresh]);
  useEffect(() => { void refresh(); }, [refresh, revision, authUser?.id, authUser?.status]);
  const value = useMemo(() => ({ messages, loading, error, revision, refresh, invalidate, removeFromFeed }), [messages, loading, error, revision, refresh, invalidate, removeFromFeed]);
  return <UniversityContext.Provider value={value}>{children}</UniversityContext.Provider>;
}

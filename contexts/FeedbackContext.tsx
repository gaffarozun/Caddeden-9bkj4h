import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { BusinessFeedback, loadBusinessFeedback, writeFeedback } from '@/services/feedbackService';

export interface FeedbackContextType {
  revision: number;
  read: (id: string, sort?: string, offset?: number) => Promise<BusinessFeedback>;
  mutate: (action: string, data: Record<string, unknown>) => Promise<void>;
  invalidate: () => void;
}
export const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const [revision, setRevision] = useState(0);
  const pending = useRef(new Map<string, Promise<BusinessFeedback>>());
  useEffect(() => { pending.current.clear(); setRevision(value => value + 1); }, [authUser?.id, authUser?.role]);
  const read = useCallback((id: string, sort = 'newest', offset = 0) => {
    const key = `${authUser?.id ?? 'guest'}:${id}:${sort}:${offset}`;
    const existing = pending.current.get(key);
    if (existing) return existing;
    const request = loadBusinessFeedback(id, sort, offset).finally(() => {
      if (pending.current.get(key) === request) pending.current.delete(key);
    });
    pending.current.set(key, request);
    return request;
  }, [authUser?.id]);
  const invalidate = useCallback(() => { pending.current.clear(); setRevision(value => value + 1); }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!AppState.currentState || AppState.currentState === 'active') invalidate(); }, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') invalidate(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [invalidate]);
  const mutate = useCallback(async (action: string, data: Record<string, unknown>) => {
    await writeFeedback(action, data);
    invalidate();
  }, [invalidate]);
  const value = useMemo(() => ({ revision, read, mutate, invalidate }), [revision, read, mutate, invalidate]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { BusinessRatingState, loadBusinessRating, loadExperienceFeature, setExperienceFeature, submitBusinessRating } from '@/services/ratingService';
interface RatingContextType {
  revision: number;
  states: Record<string, BusinessRatingState>;
  experienceEnabled: boolean;
  experienceLoading: boolean;
  experienceError: string;
  load: (id: string) => Promise<BusinessRatingState>;
  submit: (id: string, rating: number) => Promise<void>;
  setExperienceEnabled: (enabled: boolean) => Promise<void>;
  refresh: () => void;
}
export const RatingContext = createContext<RatingContextType | undefined>(undefined);
export function RatingProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const [revision, setRevision] = useState(0);
  const [states, setStates] = useState<Record<string, BusinessRatingState>>({});
  const [experienceEnabled, setEnabled] = useState(false);
  const [experienceLoading, setLoading] = useState(true);
  const [experienceError, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef(new Map<string, Promise<BusinessRatingState>>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useEffect(() => { generation.current++; pending.current.clear(); setStates({}); setEnabled(false); setLoading(true); setRevision(value => value + 1); }, [authUser?.id, authUser?.role]);
  const refresh = useCallback(() => { pending.current.clear(); setRevision(value => value + 1); }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (!AppState.currentState || AppState.currentState === 'active') refresh(); }, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    loadExperienceFeature().then(value => { if (active) { setEnabled(value === true); setError(''); } }).catch(reason => { if (active) { setEnabled(false); setError(reason instanceof Error ? reason.message : 'Özellik durumu alınamadı.'); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const load = useCallback((id: string) => {
    const existing = pending.current.get(id);
    if (existing) return existing;
    const epoch = generation.current;
    const request: Promise<BusinessRatingState> = loadBusinessRating(id).then(result => {
      if (alive.current && epoch === generation.current && pending.current.get(id) === request) setStates(previous => ({ ...previous, [id]: result }));
      return result;
    }).finally(() => { if (pending.current.get(id) === request) pending.current.delete(id); });
    pending.current.set(id, request);
    return request;
  }, []);
  const submit = useCallback(async (id: string, rating: number) => {
    await submitBusinessRating(id, rating);
    refresh();
  }, [refresh]);
  const setExperienceEnabled = useCallback(async (enabled: boolean) => {
    await setExperienceFeature(enabled);
    if (alive.current) { setEnabled(enabled); setError(''); refresh(); }
  }, [refresh]);
  const value = useMemo(() => ({ revision, states, experienceEnabled, experienceLoading, experienceError, load, submit, setExperienceEnabled, refresh }), [revision, states, experienceEnabled, experienceLoading, experienceError, load, submit, setExperienceEnabled, refresh]);
  return <RatingContext.Provider value={value}>{children}</RatingContext.Provider>;
}

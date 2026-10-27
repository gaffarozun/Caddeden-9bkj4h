import { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DiscoverCampaign, fetchDiscoverCampaigns } from '@/services/campaignService';
import { reconcileFeedOrder } from '@/services/feedOrderService';
import { useAuth } from '@/hooks/useAuth';

interface CampaignContextValue {
  campaigns: DiscoverCampaign[]; loading: boolean; error: string; revision: number;
  refresh: () => Promise<void>; invalidate: () => void;
}
export const CampaignContext = createContext<CampaignContextValue | undefined>(undefined);
export function CampaignProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const [campaigns, setCampaigns] = useState<DiscoverCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const alive = useRef(true);
  const generation = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    const request = generation.current;
    const task = (async () => {
      try {
        const result = await fetchDiscoverCampaigns();
        if (alive.current && request === generation.current) {
          setCampaigns(previous => {
            const ordered = reconcileFeedOrder(previous, result);
            return JSON.stringify(previous) === JSON.stringify(ordered) ? previous : ordered;
          });
          setError('');
        }
      } catch (reason) {
        if (alive.current && request === generation.current) { setCampaigns([]); setError(reason instanceof Error ? reason.message : 'Kampanyalar yüklenemedi.'); }
      } finally { if (alive.current && request === generation.current) setLoading(false); }
    })();
    pending.current = task;
    void task.finally(() => { if (pending.current === task) pending.current = null; });
    return task;
  }, []);
  const invalidate = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => { if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive.current = false; generation.current += 1; pending.current = null; clearInterval(timer); subscription.remove(); };
  }, [refresh]);
  useEffect(() => {
    // Each account/guest session starts its own random queue. Ignore responses from the previous account.
    generation.current += 1; pending.current = null; setCampaigns([]); setLoading(true);
    void refresh();
  }, [refresh, authUser?.id]);
  useEffect(() => { void refresh(); }, [refresh, revision, authUser?.status]);
  const value = useMemo(() => ({ campaigns, loading, error, revision, refresh, invalidate }), [campaigns, loading, error, revision, refresh, invalidate]);
  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { shuffleFeed } from '@/services/feedOrderService';
import { withRequestTimeout } from '@/services/requestTimeoutService';

// One initial request per mounted tab; subsequent requests are explicitly user-driven.
// Focus, auth polling, rating revisions and foregrounding never reset the snapshot.
export function useManualFeed<T>(fetchItems: () => Promise<T[]>, initialItems: () => T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(true);
  const fetcher = useRef(fetchItems);
  fetcher.current = fetchItems;
  const alive = useRef(false);
  const version = useRef(0);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    if (!alive.current || locked.current) return;
    locked.current = true;
    const request = ++version.current;
    setRefreshing(true);
    setError('');
    try {
      const next = await withRequestTimeout(fetcher.current(), 'İçerikler yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.');
      if (alive.current && version.current === request) setItems(shuffleFeed(next));
    } catch (reason) {
      // A failed manual refresh must retain the current cards and their order.
      if (alive.current && version.current === request) setError(reason instanceof Error ? reason.message : 'İçerikler yüklenemedi. Yeniden deneyin.');
    } finally {
      if (alive.current && version.current === request) { locked.current = false; setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; version.current++; locked.current = false; };
  }, [refresh]);
  return { items, error, refreshing, refresh };
}

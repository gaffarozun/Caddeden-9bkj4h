import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MenuSearchOptions, MenuSearchResult, searchPublicMenu } from '@/services/menuSearchService';
import { normalizeSearchText } from '@/services/searchTextService';

export function useMenuSearch(options: MenuSearchOptions) {
  const query = normalizeSearchText(options.query).slice(0, 200);
  const openIdsKey = options.openBusinessIds === null ? '*' : options.openBusinessIds.join(',');
  const params = useMemo<MenuSearchOptions>(() => ({
    query, main: options.main, sub: options.sub,
    openBusinessIds: openIdsKey === '*' ? null : openIdsKey.split(',').filter(Boolean),
  }), [query, options.main, options.sub, openIdsKey]);
  const [items, setItems] = useState<MenuSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [retryRevision, setRetryRevision] = useState(0);
  const version = useRef(0);
  const locked = useRef(false);
  const loadPage = useCallback(async (offset: number, request: number) => {
    try {
      const page = await searchPublicMenu(params, offset);
      if (version.current !== request) return;
      setItems(current => offset === 0 ? page.items : Array.from(new Map([...current, ...page.items].map(item => [item.id, item])).values()));
      setTotal(page.total);
    } catch (reason) {
      if (version.current !== request) return;
      const message = reason instanceof Error ? reason.message : 'Ürünler yüklenemedi. Yeniden deneyin.';
      if (offset === 0) setError(message); else setMoreError(message);
    } finally {
      if (version.current === request) { locked.current = false; setLoading(false); setLoadingMore(false); }
    }
  }, [params]);
  // Re-search only for user input/filter changes or an explicit retry, not tab focus/polling.
  useEffect(() => {
    const request = ++version.current;
    setItems([]); setTotal(0); setError(''); setMoreError(''); setLoadingMore(false);
    locked.current = !!query;
    setLoading(!!query);
    const timer = query ? setTimeout(() => { void loadPage(0, request); }, 250) : null;
    return () => { if (timer !== null) clearTimeout(timer); version.current += 1; locked.current = false; };
  }, [query, loadPage, retryRevision]);
  const hasMore = items.length < total;
  const loadMore = useCallback(() => {
    if (locked.current || !query || !hasMore || error) return;
    locked.current = true; setLoadingMore(true); setMoreError('');
    void loadPage(items.length, version.current);
  }, [query, hasMore, error, items.length, loadPage]);
  const retry = useCallback(() => setRetryRevision(value => value + 1), []);
  return { items, total, loading, loadingMore, error, moreError, hasMore, loadMore, retry };
}

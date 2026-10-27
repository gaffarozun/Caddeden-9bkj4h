import { useCallback, useMemo, useRef, useState } from 'react';
import { countMainIn, filterBusinessList, loadDiscoveryBusinesses } from '@/services/businessService';
import { BUSINESSES } from '@/services/mockData';
import { Business } from '@/services/types';
import { MainCategoryId, getMainCategory } from '@/services/categories';
import { getOpenStatus } from '@/services/businessStatus';
import { DiscoveryRatingSort, sortDiscoveryBusinesses } from '@/services/discoveryRatingService';
import { shuffleFeed } from '@/services/feedOrderService';
import { useManualFeed } from './useManualFeed';
import { useMenuSearch } from './useMenuSearch';
import { buildDiscoveryResults } from '@/services/discoveryResultsService';
import { sortBusinessesByProximity } from '@/services/discoveryLocationService';
import { useDiscoveryLocation } from './useDiscoveryLocation';

export function useDiscoveryFeed() {
  const [query, setQuery] = useState('');
  const [main, setMain] = useState<MainCategoryId>('yeme_icme');
  const [sub, setSub] = useState('all');
  const feed = useManualFeed<Business>(loadDiscoveryBusinesses, () => shuffleFeed(BUSINESSES));
  const allBusinesses = feed.items;
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [ratingSort, setRatingSortState] = useState<DiscoveryRatingSort>('recommended');
  const location = useDiscoveryLocation(); const selection = useRef(0);
  const setRatingSort = useCallback((sort: DiscoveryRatingSort) => {
    const ticket = ++selection.current;
    if (sort !== 'nearest') { location.clearError(); setRatingSortState(sort); return; }
    void location.locate(true).then(success => {
      if (success && ticket === selection.current) setRatingSortState('nearest');
    });
  }, [location.locate, location.clearError]);
  const businesses = useMemo(() => {
    const base = filterBusinessList(allBusinesses, main, sub, query);
    const visible = onlyOpen ? base.filter(item => getOpenStatus(item).open) : base;
    return ratingSort === 'nearest' && location.position
      ? sortBusinessesByProximity(visible, location.position)
      : sortDiscoveryBusinesses(visible, ratingSort);
  }, [allBusinesses, main, sub, query, onlyOpen, ratingSort, location.position]);
  const openBusinessIds = useMemo(() => onlyOpen ? allBusinesses
    .filter(item => /^[0-9a-f-]{36}$/i.test(item.id) && getOpenStatus(item).open)
    .map(item => item.id).sort() : null, [allBusinesses, onlyOpen]);
  const menuSearch = useMenuSearch({ query, main, sub, openBusinessIds });
  const searching = !!query.trim();
  const results = useMemo(() => buildDiscoveryResults(businesses, menuSearch.items, searching), [businesses, menuSearch.items, searching]);
  const counts = useMemo(() => ({
    yeme_icme: countMainIn(allBusinesses, 'yeme_icme'),
    guzellik_bakim: countMainIn(allBusinesses, 'guzellik_bakim'),
  }), [allBusinesses]);
  const handleMain = useCallback((id: MainCategoryId) => { setMain(id); setSub('all'); }, []);
  const refresh = useCallback(() => {
    if (feed.refreshing) return;
    menuSearch.retry();
    if (ratingSort === 'nearest') void location.locate(false);
    void feed.refresh();
  }, [feed.refresh, feed.refreshing, menuSearch.retry, ratingSort, location.locate]);
  return { query, setQuery, main, sub, setSub, onlyOpen, setOnlyOpen, ratingSort, setRatingSort,
    businesses, results, menuSearch, searching, counts, activeMain: getMainCategory(main), handleMain,
    locating: location.busy, locationError: location.error, refreshing: feed.refreshing, error: feed.error, refresh };
}

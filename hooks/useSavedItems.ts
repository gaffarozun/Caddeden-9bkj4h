import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from './useApp';
import { Business, SavedMedia } from '@/services/types';
import { buildSavedLibrary, loadSavedBusinesses, savedCategories, SavedCategory, SavedContentKind } from '@/services/savedItemsService';

export function useSavedItems() {
  const router = useRouter();
  const { hydrated, savedBusinessIds, savedPosts, savedReels, savedCampaigns } = useApp();
  const [category, setCategory] = useState<SavedCategory>('all');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<{ media: SavedMedia; kind: SavedContentKind } | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const data = await loadSavedBusinesses(savedBusinessIds);
      if (version === generation.current) setBusinesses(data);
    } catch (reason) {
      if (version === generation.current) setError(reason instanceof Error ? reason.message : 'Kayıtlı işletmeler yüklenemedi.');
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [savedBusinessIds]);

  useFocusEffect(useCallback(() => {
    if (hydrated) void load();
    return () => { generation.current += 1; };
  }, [hydrated, load]));

  const library = useMemo(() => buildSavedLibrary(businesses.filter(item => savedBusinessIds.includes(item.id)), savedPosts, savedReels, savedCampaigns), [businesses, savedBusinessIds, savedPosts, savedReels, savedCampaigns]);
  const total = savedBusinessIds.length + savedPosts.length + savedReels.length + savedCampaigns.length;
  const counts = useMemo(() => ({ all: total, business: savedBusinessIds.length, post: savedPosts.length, reel: savedReels.length, campaign: savedCampaigns.length }), [total, savedBusinessIds.length, savedPosts.length, savedReels.length, savedCampaigns.length]);
  const items = useMemo(() => category === 'all' ? library : library.filter(item => item.kind === category), [category, library]);
  const selectCategory = useCallback((value: string) => {
    if (savedCategories.some(item => item.id === value)) setCategory(value as SavedCategory);
  }, []);
  const openViewer = useCallback((media: SavedMedia, kind: SavedContentKind) => setViewer({ media, kind }), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const openBusiness = useCallback((businessId: string) => {
    setViewer(null);
    router.push(`/business/${businessId}`);
  }, [router]);

  return { category, selectCategory, items, counts, total, loading: loading || !hydrated, error, refresh: load, viewer, openViewer, closeViewer, openBusiness };
}

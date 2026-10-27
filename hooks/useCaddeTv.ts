import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchCaddeTvChannels, prefetchCaddeTvImages, reconcileCaddeTvOrder } from '@/services/caddeTvService';
import { MAIN_CATEGORIES, mainCategoryOf, MainCategoryId } from '@/services/categories';
import { Reel } from '@/services/types';
import { caddeTvStage } from '@/constants/caddeTvTheme';
import { useUniversity } from '@/hooks/useUniversity';
import { useUniversityMarquee } from '@/hooks/useUniversityMarquee';

export function useCaddeTv() {
  const router = useRouter();
  const university = useUniversity();
  const [channels, setChannels] = useState<Reel[]>([]);
  const [main, setMain] = useState<'all' | MainCategoryId>('all');
  const [selectedId, setSelectedId] = useState('');
  const [navigationRevision, setNavigationRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; generation.current += 1; };
  }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await fetchCaddeTvChannels();
      if (alive.current && request === generation.current) { setChannels(previous => reconcileCaddeTvOrder(previous, result)); setError(''); }
    } catch (reason) {
      if (alive.current && request === generation.current) setError(reason instanceof Error ? reason.message : 'Yayınlar yüklenemedi.');
    } finally {
      if (alive.current && request === generation.current) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    setForeground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    void refresh(); void university.refresh();
    const poll = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, caddeTvStage.pollMs);
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') { void refresh(); void university.refresh(); }
    });
    return () => { setFocused(false); generation.current += 1; clearInterval(poll); subscription.remove(); };
  }, [refresh, university.refresh]));
  const visible = useMemo(() => channels.filter(item => main === 'all' || mainCategoryOf(item.category) === main), [channels, main]);
  const index = Math.max(0, visible.findIndex(item => item.id === selectedId));
  const current = visible[index] ?? null;
  const nextImage = visible.length ? visible[(index + 1) % visible.length]?.image : undefined;
  const previousImage = visible.length ? visible[(index + visible.length - 1) % visible.length]?.image : undefined;
  useEffect(() => {
    if (focused && foreground) void prefetchCaddeTvImages([current?.image ?? '', nextImage ?? '', previousImage ?? '']);
  }, [focused, foreground, current?.image, nextImage, previousImage]);
  const visibleRef = useRef<Reel[]>([]);
  visibleRef.current = visible;
  const changeChannel = useCallback((step: number) => {
    if (visibleRef.current.length < 2) return;
    setSelectedId(previousId => {
      const available = visibleRef.current;
      if (available.length < 2) return previousId;
      const position = Math.max(0, available.findIndex(item => item.id === previousId));
      return available[(position + step + available.length) % available.length].id;
    });
    // Every manual action starts a fresh seven-second viewing window, including rapid taps.
    setNavigationRevision(value => value + 1);
  }, []);
  const next = useCallback(() => changeChannel(1), [changeChannel]);
  const previous = useCallback(() => changeChannel(-1), [changeChannel]);
  useEffect(() => {
    if (!focused || !foreground || loading || visible.length < 2) return;
    const timer = setTimeout(next, caddeTvStage.autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [focused, foreground, loading, visible.length, current?.id, navigationRevision, next]);
  const selectMain = useCallback((value: string) => {
    setMain(value as 'all' | MainCategoryId); setSelectedId('');
    setNavigationRevision(value => value + 1);
  }, []);
  const categories = useMemo(() => [{ id: 'all', label: 'Tüm yayınlar' }, ...MAIN_CATEGORIES], []);
  const subtitleItems = useMemo(() => university.messages.length
    ? university.messages.map(item => ({ id: item.id, text: item.text }))
    : [{ id: 'tv-subtitle-state', text: university.error ? 'Yazı akışı yüklenemedi. Yeniden yükleyebilirsin.' : university.loading ? 'Kampüsün sesi hazırlanıyor…' : 'İlk söz senin. Yazını gönder; yönetici onayıyla burada aksın.' }], [university.messages, university.error, university.loading]);
  const subtitleText = useMemo(() => subtitleItems.map(item => item.text).join('   ◆   '), [subtitleItems]);
  const motion = useUniversityMarquee(subtitleText);
  const write = useCallback(() => router.push('/university'), [router]);
  const openBusiness = useCallback(() => { if (current) router.push(`/business/${current.businessId}`); }, [router, current]);
  const retry = useCallback(() => { void refresh(); void university.refresh(); }, [refresh, university.refresh]);
  return { current, total: visible.length, index, main, categories, selectMain, loading, error, next, previous,
    subtitleItems, subtitleText, motion, write, openBusiness, retry };
}

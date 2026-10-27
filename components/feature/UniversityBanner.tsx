import React, { memo, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useUniversity } from '@/hooks/useUniversity';
import { NeonTicker, NeonTickerHeader } from '@/components/feature/NeonTicker';

interface UniversityNeonHeaderProps { leftAction?: React.ReactNode; rightAction?: React.ReactNode }
export const UniversityNeonHeader = memo(function UniversityNeonHeader(props: UniversityNeonHeaderProps) {
  return <NeonTickerHeader title="ÜNİVERSİTEDEN" {...props} />;
});
interface UniversityBannerProps { compact?: boolean }
export const UniversityBanner = memo(function UniversityBanner({ compact = false }: UniversityBannerProps) {
  const { messages, loading, error, refresh } = useUniversity();
  const router = useRouter();
  const items = useMemo(() => messages.length ? messages.map(item => ({ id: item.id, text: item.text })) : [{
    id: 'university-empty', text: error ? 'Yazılar yüklenemedi · Yeniden dene' : loading ? 'Kampüsten sesler hazırlanıyor' : 'İlk söz senin · Yazını gönder, onaylanınca burada aksın',
  }], [messages, loading, error]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const open = useCallback(() => router.push('/university'), [router]);
  const retry = useCallback(() => { void refresh(); }, [refresh]);
  return <NeonTicker title="ÜNİVERSİTEDEN" items={items} compact={compact} error={error} onRetry={retry} onAction={open} actionLabel="Üniversiteden için kendi yazını paylaş" />;
});

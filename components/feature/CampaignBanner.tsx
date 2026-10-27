import { memo, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useAuth } from '@/hooks/useAuth';
import { MainCategoryId } from '@/services/categories';
import { CampaignTicker } from '@/components/feature/CampaignTicker';

interface CampaignBannerProps { main: MainCategoryId }
export const CampaignBanner = memo(function CampaignBanner({ main }: CampaignBannerProps) {
  const { campaigns, loading, error, refresh } = useCampaigns();
  const { authUser } = useAuth();
  const router = useRouter();
  const visible = useMemo(() => campaigns.filter(item => item.main === main), [campaigns, main]);
  const items = useMemo(() => visible.length ? visible.map(item => ({ id: item.id, text: `${item.name} · ${item.title}`, signature: 'CADDEDEN', selectable: true })) : [{
    id: 'campaign-empty', text: error ? 'Kampanyalar yüklenemedi · Yeniden dene' : loading ? 'Güncel kampanyalar hazırlanıyor' : 'Bu kategoride henüz yayında kampanya yok', selectable: false,
  }], [visible, error, loading]);
  const select = useCallback((id: string) => {
    const campaign = visible.find(item => item.id === id);
    if (campaign) router.push({ pathname: '/business/[id]', params: { id: campaign.businessId } });
  }, [router, visible]);
  const submit = useCallback(() => router.push('/business/campaigns'), [router]);
  const retry = useCallback(() => { void refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <CampaignTicker items={items} error={error} onRetry={retry} onSelect={select} onSubmit={authUser?.role === 'business' ? submit : undefined} />;
});

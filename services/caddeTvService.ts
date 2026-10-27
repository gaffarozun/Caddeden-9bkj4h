import { Image } from 'expo-image';
import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from '@/services/requestTimeoutService';
import { caddeTvCreative } from '@/constants/caddeTvTheme';
import { CategoryId, Reel } from '@/services/types';
import { reconcileFeedOrder } from '@/services/feedOrderService';

interface TvChannelRow {
  id: string; business_id: string; business_name: string; category: string;
  image_url: string; caption: string; sponsored: boolean;
}
export async function fetchCaddeTvChannels(): Promise<Reel[]> {
  const { data, error } = await withRequestTimeout(getSupabaseClient().rpc('public_cadde_tv_channels'), 'Cadde TV yayınları yüklenemedi.');
  if (error) throw new Error(error.message);
  return ((data ?? []) as TvChannelRow[]).map(row => ({
    id: row.id, businessId: row.business_id, businessName: row.business_name,
    category: row.category as CategoryId, image: row.image_url, caption: '',
    sponsored: row.sponsored, likes: 0,
  }));
}
// Viewer-local Fisher–Yates order. Polling updates data without rearranging the queue.
// No user identifiers or publication decisions are written to the backend.
export function reconcileCaddeTvOrder(previous: Reel[], incoming: Reel[], random: () => number = Math.random): Reel[] {
  return reconcileFeedOrder(previous, incoming, random);
}

// Warm only the current and adjacent creatives, not the complete channel library.
export async function prefetchCaddeTvImages(images: string[]): Promise<void> {
  const urls = Array.from(new Set(images.filter(Boolean))).slice(0, 3);
  if (!urls.length) return;
  try { await Image.prefetch(urls, { cachePolicy: 'memory-disk' }); } catch { /* Display still loads images normally. */ }
}

// Rounded output dimensions may differ by one pixel. Invalid creatives never proceed to upload.
export function caddeTvCreativeError(width?: number, height?: number): string | null {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || Math.abs(width / height - caddeTvCreative.value) > 0.015) {
    return 'Görseli Cadde TV ekranı oranında kırpın. Önerilen ölçü 1584 × 1008 px; yalnızca çerçevenin içi yayınlanır.';
  }
  return null;
}
export function caddeTvDisplayName(value: string): string {
  return value.replace(/reels?/gi, 'Cadde TV');
}

// Powered by OnSpace.AI
// Business-facing advertising service: apply for ads and track status.
// Prices/status are enforced server-side (protect_ad_insert trigger) from the
// admin-defined packages; clients can never set them.
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import { businessAccessError } from './accountAccessService';
import { caddeTvCreativeError, caddeTvDisplayName } from './caddeTvService';

const sb = () => getSupabaseClient();
const BUCKET = 'business-media';

export const AD_TYPE_LABELS: Record<string, string> = {
  discover_featured: 'Keşfet Öne Çıkarma',
  reels_sponsored: 'Cadde TV Sponsorlu',
  posts_sponsored: 'Gönderi Sponsorlu',
  category_featured: 'Kategori Öne Çıkarma',
  map_featured: 'Harita Öne Çıkarma',
  home_promo: 'Ana Sayfa Tanıtım',
  notification_promo: 'Bildirim Reklamı',
  content_reel: 'Cadde TV Paylaşımı',
  content_post: 'Gönderi Paylaşımı',
  content_campaign: 'Kampanya Paylaşımı',
  business_notification: 'İşletme Bildirimi',
};

// Reklam Yönetimi paketleri — içerik/bildirim fiyatlandırmasından ayrı tutulur.
export const AD_PACKAGE_TYPES = [
  'discover_featured',
  'reels_sponsored',
  'posts_sponsored',
  'category_featured',
  'map_featured',
  'home_promo',
  'notification_promo',
];

export interface AdPackage {
  id: string;
  name: string;
  type: string;
  description: string | null;
  price: number;
  duration_days: number;
  active: boolean;
}

export interface MyBusiness {
  id: string;
  name: string;
  approval_status: string;
}

export interface MyAd {
  id: string;
  title: string | null;
  type: string;
  status: string;
  price: number;
  payment_status: string;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  rejection_reason: string | null;
  created_at: string;
  businesses?: { name?: string } | null;
}

export async function listActivePackages(): Promise<{ data: AdPackage[]; error: string | null }> {
  const { data, error } = await sb().from('ad_packages').select('*').eq('active', true).order('price');
  return { data: ((data as AdPackage[]) ?? []).map(item => ({ ...item, name: caddeTvDisplayName(item.name) })), error: error?.message ?? null };
}

// Active packages filtered to specific types (e.g. ad types only, or a single
// content/notification type) so each screen shows only the relevant plans.
export async function listActivePackagesByTypes(
  types: string[]
): Promise<{ data: AdPackage[]; error: string | null }> {
  const { data, error } = await sb()
    .from('ad_packages')
    .select('*')
    .eq('active', true)
    .in('type', types)
    .order('duration_days')
    .order('price');
  return { data: ((data as AdPackage[]) ?? []).map(item => ({ ...item, name: caddeTvDisplayName(item.name) })), error: error?.message ?? null };
}

export async function listMyBusinesses(ownerId: string): Promise<{ data: MyBusiness[]; error: string | null }> {
  const denied = await businessAccessError(undefined, ownerId); if (denied) return { data: [], error: denied };
  const { data, error } = await sb()
    .from('businesses')
    .select('id, name, approval_status')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  return { data: (data as MyBusiness[]) ?? [], error: error?.message ?? null };
}

export async function listMyAds(): Promise<{ data: MyAd[]; error: string | null }> {
  const denied = await businessAccessError(); if (denied) return { data: [], error: denied };
  // RLS restricts rows to ads whose business is owned by the caller.
  const { data, error } = await sb()
    .from('ads')
    .select('*, businesses(name)')
    .order('created_at', { ascending: false });
  return { data: (data as MyAd[]) ?? [], error: error?.message ?? null };
}

export async function applyForAd(params: {
  business_id: string;
  package_id: string;
  type: string;
  title: string;
  image_url?: string | null;
  image_width?: number;
  image_height?: number;
}): Promise<{ error: string | null }> {
  if (params.type === 'reels_sponsored') {
    const invalid = caddeTvCreativeError(params.image_width, params.image_height);
    if (invalid || !params.image_url) return { error: invalid ?? 'Cadde TV reklamı için bir görsel gerekli.' };
  }
  const denied = await businessAccessError(params.business_id); if (denied) return { error: denied };
  // price/status/payment_status are intentionally omitted: the DB trigger sets
  // them authoritatively (price from the package, status=pending, unpaid).
  const { error } = await sb().from('ads').insert({
    business_id: params.business_id,
    package_id: params.package_id,
    type: params.type,
    // TV is a photo-only channel. Preserve text for every other advertising type.
    title: params.type === 'reels_sponsored' ? null : params.title,
    image_url: params.image_url ?? null,
  });
  return { error: error?.message ?? null };
}

// Upload an ad creative (e.g. Reels sponsored image at 9:3) to the business
// bucket. The owner-scoped storage policy authorizes {business_id}/ads/ paths.
export async function uploadAdImage(
  businessId: string,
  base64: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const denied = await businessAccessError(businessId); if (denied) return { url: null, error: denied };
    const path = `${businessId}/ads/${Date.now()}.jpg`;
    const { error: upErr } = await sb()
      .storage.from(BUCKET)
      .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
    if (upErr) return { url: null, error: upErr.message };
    const { data: pub } = sb().storage.from(BUCKET).getPublicUrl(path);
    return { url: pub.publicUrl, error: null };
  } catch (e) {
    return { url: null, error: (e as Error)?.message ?? 'Yükleme başarısız.' };
  }
}

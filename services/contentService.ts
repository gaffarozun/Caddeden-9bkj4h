// Powered by OnSpace.AI
// Business photos: Cadde TV has no caption; regular posts preserve their caption flow.
// Images upload to the business-media bucket under {business_id}/content/.
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import { businessAccessError, ownedRowAccessError } from './accountAccessService';
import { caddeTvCreativeError } from './caddeTvService';
import { broadcastDay } from './mediaPublicationService';

const sb = () => getSupabaseClient();
const BUCKET = 'business-media';

export type ContentKind = 'post' | 'reel';

export interface FeedItem {
  id: string;
  business_id: string;
  kind: ContentKind;
  image_url: string;
  caption: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  end_date?: string | null;
  start_date?: string | null;
  businesses?: { name?: string; category?: string } | null;
}

export async function listFeed(kind: ContentKind): Promise<{ data: FeedItem[]; error: string | null }> {
  // Only approved + unexpired content is public. RLS also enforces approved, but
  // we filter explicitly so an owner never sees their own pending rows here, and
  // honour the admin-set end_date (e.g. a Reels that runs for 30 days).
  const today = broadcastDay();
  const { data, error } = await sb()
    .from('business_posts')
    .select('*, businesses(name, category)')
    .eq('kind', kind)
    .eq('status', 'approved')
    .neq('image_url', '')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('created_at', { ascending: false })
    .limit(60);
  return { data: (data as FeedItem[]) ?? [], error: error?.message ?? null };
}

export async function listMyContent(ownerId: string): Promise<{ data: FeedItem[]; error: string | null }> {
  const denied = await businessAccessError(undefined, ownerId); if (denied) return { data: [], error: denied };
  const { data, error } = await sb()
    .from('business_posts')
    .select('*, businesses!inner(name, category, owner_id)')
    .eq('businesses.owner_id', ownerId)
    .order('created_at', { ascending: false });
  return { data: (data as FeedItem[]) ?? [], error: error?.message ?? null };
}

export async function createContent(params: {
  business_id: string;
  kind: ContentKind;
  caption: string;
  base64: string;
  image_width?: number;
  image_height?: number;
  package_id?: string | null;
  price?: number;
}): Promise<{ error: string | null }> {
  try {
    if (params.kind === 'reel') {
      const invalid = caddeTvCreativeError(params.image_width, params.image_height);
      if (invalid) return { error: invalid };
    }
    const denied = await businessAccessError(params.business_id); if (denied) return { error: denied };
    const path = `${params.business_id}/content/${Date.now()}.jpg`;
    const { error: upErr } = await sb()
      .storage.from(BUCKET)
      .upload(path, decode(params.base64), { contentType: 'image/jpeg', upsert: false });
    if (upErr) return { error: upErr.message };
    const { data: pub } = sb().storage.from(BUCKET).getPublicUrl(path);
    // status is forced to 'pending' server-side; package_id/price are stored for
    // the admin approval + payment-tracking flow.
    const { error } = await sb().from('business_posts').insert({
      business_id: params.business_id,
      kind: params.kind,
      image_url: pub.publicUrl,
      caption: params.kind === 'reel' ? null : params.caption || null,
      package_id: params.package_id ?? null,
      price: params.price ?? 0,
    });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: (e as Error)?.message ?? 'Yükleme başarısız.' };
  }
}

export async function deleteContent(id: string): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('business_posts', id); if (denied) return { error: denied };
  const { error } = await sb().from('business_posts').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

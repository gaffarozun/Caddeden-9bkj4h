import { getSupabaseClient } from '@/template';
import { fetchBusinessDetail, getBusinessById } from './businessService';
import { Business, MenuItem } from './types';
import { shuffleFeed } from './feedOrderService';

export interface ProfileCampaign { id: string; title: string; description: string }
export interface ProfileEvent { id: string; title: string; image: string; createdAt: string }
export interface BusinessProfileData { business: Business; ownerId: string | null; isDemo: boolean; campaigns: ProfileCampaign[]; events: ProfileEvent[] }
export async function loadBusinessProfile(id: string): Promise<BusinessProfileData> {
  const demo = getBusinessById(id);
  if (demo) return { business: demo, ownerId: null, isDemo: true, campaigns: demo.campaign ? [{ id: `mock-${id}`, title: demo.campaign, description: '' }] : [], events: [] };
  const business = await fetchBusinessDetail(id);
  if (!business) throw new Error('İşletme bulunamadı veya yayında değil.');
  const today = localDate(new Date());
  const sb = getSupabaseClient();
  const [owner, campaigns, events] = await Promise.all([
    sb.from('businesses').select('owner_id').eq('id', id).maybeSingle(),
    sb.from('campaigns').select('id,title,description').eq('business_id', id).eq('status', 'approved').eq('payment_status', 'paid').gt('price', 0).lte('start_date', today).gte('end_date', today).order('created_at', { ascending: false }).limit(10),
    sb.from('business_posts').select('id,caption,image_url,created_at').eq('business_id', id).eq('status', 'approved').or(`start_date.is.null,start_date.lte.${today}`).or(`end_date.is.null,end_date.gte.${today}`).order('created_at', { ascending: false }).limit(20),
  ]);
  if (owner.error) throw new Error(owner.error.message);
  if (campaigns.error) throw new Error(campaigns.error.message);
  if (events.error) throw new Error(events.error.message);
  return { business, ownerId: owner.data?.owner_id ?? null, isDemo: false,
    campaigns: shuffleFeed((campaigns.data ?? []).map(row => ({ id: row.id, title: row.title, description: row.description ?? '' }))),
    events: (events.data ?? []).map(row => ({ id: row.id, title: row.caption ?? 'İşletme duyurusu', image: row.image_url, createdAt: row.created_at })),
  };
}
export function menuGroups(items: MenuItem[]) {
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) { const name = item.group?.trim() || 'Menü'; groups.set(name, [...(groups.get(name) ?? []), item]); }
  return Array.from(groups, ([name, items]) => ({ name, items }));
}
export function money(value: number) { return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`; }
export function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function isGoogleMapsUrl(value: string) {
  return /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl|(?:www\.)?google\.(?:com\.tr|com)|maps\.google\.(?:com\.tr|com))(?:[/?#]|$)/i.test(value.trim());
}
export function businessMapsUrl(business: Business) {
  if (business.mapsUrl && isGoogleMapsUrl(business.mapsUrl)) return business.mapsUrl;
  const query = business.lat != null && business.lng != null ? `${business.lat},${business.lng}` : business.address || business.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function isActiveOrder(status: string) { return ['pending', 'approved', 'preparing', 'on_the_way'].includes(status); }

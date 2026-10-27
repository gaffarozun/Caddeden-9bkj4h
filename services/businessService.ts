// Powered by OnSpace.AI
import { getSupabaseClient } from '@/template';
import { BUSINESSES } from './mockData';
import { Business } from './types';
import { MainCategoryId, getSubCategory } from './categories';
import { attachStarRatings } from './ratingService';
import { searchNameMatches } from './searchTextService';

export function getBusinessById(id?: string): Business | undefined {
  return BUSINESSES.find(b => b.id === id);
}
export function getFeatured(): Business[] {
  return BUSINESSES.filter(b => b.featured);
}
export function getCampaignBusinesses(main?: MainCategoryId): Business[] {
  return BUSINESSES.filter(b => !!b.campaign && (!main || getSubCategory(b.category)?.main === main));
}
export function countByMain(main: MainCategoryId): number {
  return BUSINESSES.filter(b => getSubCategory(b.category)?.main === main).length;
}
export function filterBusinesses(main: MainCategoryId | 'all', sub: string | 'all', query: string): Business[] {
  return filterBusinessList(BUSINESSES, main, sub, query);
}

function mapBusinessRow(row: Record<string, any>, includeMenu = false): Business {
  const images: string[] = Array.isArray(row.images) ? row.images : [];
  const cover = row.cover_url || images[0] || row.logo_url || '';
  const sub = getSubCategory(row.category);
  const menu = includeMenu ? ((row.menu_items as any[]) ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(m => ({
    id: m.id, name: m.name, price: Number(m.price ?? 0), image: m.image_url ?? undefined, group: m.group_name ?? undefined,
    description: m.description ?? undefined, durationMin: m.duration_min ?? undefined,
  })) : [];
  return {
    id: row.id, name: row.name, category: row.category, description: row.description ?? '', cover,
    images: images.length ? images : cover ? [cover] : [],
    logo: row.logo_url || undefined, mapsUrl: row.maps_url || undefined,
    menuCover: row.menu_cover_url || undefined,
    menuGroupCovers: row.menu_group_covers && typeof row.menu_group_covers === 'object' && !Array.isArray(row.menu_group_covers) ? row.menu_group_covers : {},
    profileTags: Array.isArray(row.profile_tags) ? row.profile_tags.filter((tag: unknown) => typeof tag === 'string') : [],
    lat: row.lat ?? undefined, lng: row.lng ?? undefined,
    rating: Number(row.rating ?? 0), reviewCount: row.review_count ?? 0, distanceKm: 0,
    address: row.address ?? '', phone: row.phone ?? '', hours: row.hours ?? '',
    openTime: row.open_time ?? undefined, closeTime: row.close_time ?? undefined,
    openDays: Array.isArray(row.open_days) ? row.open_days : undefined,
    statusMode: row.status_mode === 'auto' ? 'auto' : row.status_mode === 'manual' ? 'manual' : undefined,
    avgDeliveryMinutes: row.avg_delivery_minutes ?? undefined,
    isOpen: !!row.is_open, featured: !!row.featured, campaign: undefined, hasMenu: !!sub?.hasMenu,
    allowMenu: typeof row.allow_menu === 'boolean' ? row.allow_menu : undefined,
    allowReservation: typeof row.allow_reservation === 'boolean' ? row.allow_reservation : undefined,
    allowOrder: typeof row.allow_order === 'boolean' ? row.allow_order : undefined,
    minOrder: row.min_order != null ? Number(row.min_order) : undefined, menu, pin: { x: 0, y: 0 },
  };
}
async function withRatings(items: Business[]): Promise<Business[]> {
  try { return await attachStarRatings(items); }
  catch { return items; } // Preserve discovery if the independent rating transport is temporarily unavailable.
}
export async function fetchBusinessDetail(id?: string): Promise<Business | null> {
  if (!id) return null;
  const { data, error } = await getSupabaseClient().from('businesses').select('*, menu_items(*)').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return (await withRatings([mapBusinessRow(data as Record<string, any>, true)]))[0];
}
export async function fetchBusinessesByIds(ids: string[]): Promise<Business[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];
  // Demo ids are not UUIDs; do not include them in the PostgreSQL UUID query.
  const realIds = unique.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const result = realIds.length ? await getSupabaseClient().from('businesses').select('*').in('id', realIds) : { data: [], error: null };
  if (result.error) throw new Error(result.error.message);
  const real = Array.isArray(result.data) ? await withRatings(result.data.map(map => mapBusinessRow(map))) : [];
  const byId = new Map<string, Business>();
  real.forEach(b => byId.set(b.id, b));
  BUSINESSES.forEach(b => { if (unique.includes(b.id) && !byId.has(b.id)) byId.set(b.id, b); });
  return unique.map(id => byId.get(id)).filter((b): b is Business => !!b);
}
export async function fetchApprovedBusinesses(): Promise<Business[]> {
  const { data, error } = await getSupabaseClient().from('businesses').select('*').eq('approval_status', 'approved').eq('is_published', true).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('İşletmeler yüklenemedi. Yeniden deneyin.');
  return withRatings(data.map(row => mapBusinessRow(row)));
}
export async function loadDiscoveryBusinesses(): Promise<Business[]> {
  return mergeBusinesses(await fetchApprovedBusinesses(), BUSINESSES);
}
export function mergeBusinesses(real: Business[], mock: Business[]): Business[] {
  const byId = new Map<string, Business>();
  real.forEach(b => byId.set(b.id, b));
  mock.forEach(b => { if (!byId.has(b.id)) byId.set(b.id, b); });
  return Array.from(byId.values());
}
export function filterBusinessList(list: Business[], main: MainCategoryId | 'all', sub: string | 'all', query: string): Business[] {
  const q = query.trim();
  return list.filter(b => {
    const category = getSubCategory(b.category);
    const matchMain = main === 'all' || category?.main === main;
    const matchSub = sub === 'all' || category?.id === sub;
    const matchQuery = !q || searchNameMatches(b.name, q) || searchNameMatches(category?.label ?? '', q) || searchNameMatches(b.campaign ?? '', q);
    return matchMain && matchSub && matchQuery;
  });
}
export function countMainIn(list: Business[], main: MainCategoryId): number {
  return list.filter(b => getSubCategory(b.category)?.main === main).length;
}

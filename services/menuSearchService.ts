import { getSupabaseClient } from '@/template';
import { MainCategoryId, normalizeCategory } from './categories';
import { normalizeSearchText } from './searchTextService';
import { withRequestTimeout } from './requestTimeoutService';

export const menuSearchPageSize = 40;
export interface MenuSearchResult {
  id: string;
  businessId: string;
  businessName: string;
  category: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  group?: string;
  durationMin?: number;
  rating: number;
  ratingCount: number;
}
export interface MenuSearchOptions {
  query: string;
  main: MainCategoryId;
  sub: string;
  openBusinessIds: string[] | null;
}
export interface MenuSearchPage { items: MenuSearchResult[]; total: number }
export async function searchPublicMenu(options: MenuSearchOptions, offset = 0): Promise<MenuSearchPage> {
  const query = normalizeSearchText(options.query).slice(0, 200);
  if (!query) return { items: [], total: 0 };
  const { data, error } = await withRequestTimeout(getSupabaseClient().rpc('public_menu_search', {
    p_query: query, p_main: options.main, p_sub: options.sub === 'all' ? 'all' : normalizeCategory(options.sub),
    p_open_ids: options.openBusinessIds, p_offset: Math.max(0, offset), p_limit: menuSearchPageSize,
  }), 'Ürün araması zaman aşımına uğradı. Yeniden deneyin.');
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.items)) throw new Error('Ürün arama yanıtı okunamadı.');
  const items: MenuSearchResult[] = data.items.map((row: Record<string, unknown>) => ({
    id: String(row.item_id), businessId: String(row.business_id), businessName: String(row.business_name),
    category: String(row.category), name: String(row.name), price: Number(row.price),
    description: typeof row.description === 'string' ? row.description : undefined,
    image: typeof row.image_url === 'string' && row.image_url ? row.image_url : undefined,
    group: typeof row.group_name === 'string' ? row.group_name : undefined,
    durationMin: row.duration_min != null ? Number(row.duration_min) : undefined,
    rating: Number(row.rating ?? 0), ratingCount: Number(row.rating_count ?? 0),
  }));
  return { items, total: Math.max(0, Number(data.total ?? 0)) };
}

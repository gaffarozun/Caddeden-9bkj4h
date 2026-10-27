// Powered by OnSpace.AI
// Owner-facing business management: view & edit own profile, media, price list.
// All operations are RLS-protected to the authenticated owner (owner_id = auth.uid()).
// Protected columns (approval_status, is_published, featured, rating, owner_id) are
// enforced server-side by the protect_business_cols trigger and cannot be changed here.
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import { businessAccessError, ownedRowAccessError } from './accountAccessService';

const sb = () => getSupabaseClient();
const BUCKET = 'business-media';

export interface OwnedBusinessFull {
  id: string;
  owner_id: string;
  main_category: string;
  category: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  images: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  hours: string | null;
  status_mode: string;
  open_time: string | null;
  close_time: string | null;
  open_days: number[];
  avg_delivery_minutes: number | null;
  allow_menu: boolean;
  allow_reservation: boolean;
  allow_order: boolean;
  min_order: number;
  is_open: boolean;
  approval_status: string;
  is_published: boolean;
  rejection_reason: string | null;
  rating: number;
  review_count: number;
}

export interface MenuItemRow {
  id: string;
  business_id: string;
  group_name: string | null;
  name: string;
  description: string | null;
  price: number;
  item_type: string;
  duration_min: number | null;
  image_url: string | null;
  sort_order: number;
}

export async function fetchOwnedBusiness(
  id: string,
  ownerId: string
): Promise<{ data: OwnedBusinessFull | null; error: string | null }> {
  const denied = await businessAccessError(id, ownerId); if (denied) return { data: null, error: denied };
  const { data, error } = await sb()
    .from('businesses')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  const row = data as Record<string, any>;
  return {
    data: {
      id: row.id,
      owner_id: row.owner_id,
      main_category: row.main_category,
      category: row.category,
      name: row.name,
      description: row.description ?? null,
      logo_url: row.logo_url ?? null,
      cover_url: row.cover_url ?? null,
      images: Array.isArray(row.images) ? row.images : [],
      phone: row.phone ?? null,
      email: row.email ?? null,
      address: row.address ?? null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      hours: row.hours ?? null,
      status_mode: row.status_mode ?? 'manual',
      open_time: row.open_time ?? null,
      close_time: row.close_time ?? null,
      open_days: Array.isArray(row.open_days) ? row.open_days : [0, 1, 2, 3, 4, 5, 6],
      avg_delivery_minutes: row.avg_delivery_minutes ?? null,
      allow_menu: row.allow_menu !== false,
      allow_reservation: row.allow_reservation !== false,
      allow_order: row.allow_order === true,
      min_order: Number(row.min_order ?? 0),
      is_open: !!row.is_open,
      approval_status: row.approval_status ?? 'pending',
      is_published: !!row.is_published,
      rejection_reason: row.rejection_reason ?? null,
      rating: Number(row.rating ?? 0),
      review_count: row.review_count ?? 0,
    },
    error: null,
  };
}

export async function updateBusinessProfile(
  id: string,
  patch: Record<string, unknown>
): Promise<{ error: string | null }> {
  const denied = await businessAccessError(id); if (denied) return { error: denied };
  const { data, error } = await sb().from('businesses').update(patch).eq('id', id).select('id').maybeSingle();
  return { error: error?.message ?? (!data ? 'İşletme bulunamadı veya yetkiniz değişti.' : null) };
}

// Upload an image to the business-media bucket under {businessId}/{folder}/.
// The owner-scoped storage policy authorizes this path.
export async function uploadBusinessMedia(
  businessId: string,
  base64: string,
  folder: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const denied = await businessAccessError(businessId); if (denied) return { url: null, error: denied };
    const path = `${businessId}/${folder}/${Date.now()}.jpg`;
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

export async function listMenuItems(
  businessId: string
): Promise<{ data: MenuItemRow[]; error: string | null }> {
  const { data, error } = await sb()
    .from('menu_items')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return { data: (data as MenuItemRow[]) ?? [], error: error?.message ?? null };
}

export async function addMenuItem(item: {
  business_id: string;
  name: string;
  price: number;
  group_name?: string | null;
  description?: string | null;
  item_type?: string;
  duration_min?: number | null;
  image_url?: string | null;
  sort_order?: number;
}): Promise<{ error: string | null }> {
  const denied = await businessAccessError(item.business_id); if (denied) return { error: denied };
  const { error } = await sb().from('menu_items').insert({
    business_id: item.business_id,
    name: item.name,
    price: item.price,
    group_name: item.group_name ?? null,
    description: item.description ?? null,
    item_type: item.item_type ?? 'product',
    duration_min: item.duration_min ?? null,
    image_url: item.image_url ?? null,
    sort_order: item.sort_order ?? 0,
  });
  return { error: error?.message ?? null };
}

export async function deleteMenuItem(id: string): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('menu_items', id); if (denied) return { error: denied };
  const { error } = await sb().from('menu_items').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function updateMenuItem(
  id: string,
  patch: Partial<Pick<MenuItemRow, 'name' | 'price' | 'group_name' | 'description' | 'duration_min' | 'image_url'>>
): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('menu_items', id); if (denied) return { error: denied };
  const { error } = await sb().from('menu_items').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

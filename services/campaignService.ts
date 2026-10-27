// Campaign submission prices and dates are authoritative database values.
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import { businessAccessError, ownedRowAccessError } from './accountAccessService';
import { MainCategoryId, getSubCategory } from './categories';
import { withRequestTimeout } from './requestTimeoutService';

export interface MyCampaign {
  id: string; business_id: string; title: string; description: string | null; image_url: string | null;
  status: string; rejection_reason: string | null; created_at: string; price: number; payment_status: string;
  publication_days: number | null; start_date: string | null; end_date: string | null;
  businesses?: { name?: string; category?: string } | null;
}
export interface DiscoverCampaign {
  id: string; businessId: string; title: string; description?: string; name: string;
  category: string; cover: string; main?: MainCategoryId;
}
export const campaignTitleLimit = 160;
export function campaignMoney(value: number) { return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`; }
export async function listMyCampaigns(ownerId: string): Promise<{ data: MyCampaign[]; error: string | null }> {
  const denied = await businessAccessError(undefined, ownerId);
  if (denied) return { data: [], error: denied };
  const { data, error } = await getSupabaseClient().from('campaigns')
    .select('*, businesses!campaigns_business_id_fkey!inner(name, category, owner_id)')
    .eq('businesses.owner_id', ownerId).order('created_at', { ascending: false });
  return { data: (data as MyCampaign[]) ?? [], error: error?.message ?? null };
}
export async function createCampaign(params: {
  business_id: string; title: string; description: string; base64?: string | null;
  package_id: string; quotedPrice: number; quotedDays: number;
}): Promise<{ error: string | null }> {
  try {
    const denied = await businessAccessError(params.business_id);
    if (denied) return { error: denied };
    const sb = getSupabaseClient();
    let imageUrl: string | null = null;
    if (params.base64) {
      const path = `${params.business_id}/campaigns/${Date.now()}.jpg`;
      const { error } = await sb.storage.from('business-media').upload(path, decode(params.base64), { contentType: 'image/jpeg', upsert: false });
      if (error) return { error: error.message };
      imageUrl = sb.storage.from('business-media').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await withRequestTimeout(sb.rpc('submit_paid_campaign', {
      p_business: params.business_id, p_package: params.package_id, p_title: params.title,
      p_description: params.description, p_image: imageUrl, p_price: params.quotedPrice, p_days: params.quotedDays,
    }), 'Başvuru yanıtı gecikti. Yeniden göndermeden önce kampanyalarınızı yenileyin.');
    return { error: error?.message ?? null };
  } catch (reason) { return { error: reason instanceof Error ? reason.message : 'Kampanya oluşturulamadı.' }; }
}
export async function deleteCampaign(id: string): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('campaigns', id);
  if (denied) return { error: denied };
  const { error } = await getSupabaseClient().from('campaigns').delete().eq('id', id);
  return { error: error?.message ?? null };
}
export async function fetchDiscoverCampaigns(): Promise<DiscoverCampaign[]> {
  // Safe projection applies payment, business visibility and expiry using the database clock,
  // including when the caller is an owner or administrator who can read private raw rows.
  const { data, error } = await withRequestTimeout(getSupabaseClient().rpc('public_paid_campaigns'), 'Kampanyalar yüklenemedi. Yeniden deneyin.');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; business_id: string; title: string; description: string | null; name: string; category: string; cover: string }>;
  return rows.map(row => ({ id: row.id, businessId: row.business_id, title: row.title, description: row.description ?? '', name: row.name, category: row.category, cover: row.cover, main: getSubCategory(row.category)?.main }));
}

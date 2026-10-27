import { getSupabaseClient } from '@/template';
export type AccountRole = 'user' | 'business' | 'admin';
export const customerAccessMessage = 'Bu işlem yalnızca aktif müşteri hesaplarına açıktır.';
export const businessAccessMessage = 'İşletme işlemleri yalnızca yönetici tarafından onaylanmış yetkili işletme hesaplarına açıktır.';
export async function requireCustomer(): Promise<string> {
  const sb = getSupabaseClient();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) throw new Error('Giriş yapmanız gerekiyor.');
  const { data, error } = await sb.rpc('account_customer');
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error(customerAccessMessage);
  return auth.user.id;
}
export async function requireBusinessAccess(businessId?: string, expectedUserId?: string): Promise<string> {
  const sb = getSupabaseClient();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) throw new Error('Giriş yapmanız gerekiyor.');
  if (expectedUserId && auth.user.id !== expectedUserId) throw new Error(businessAccessMessage);
  const { data, error } = businessId
    ? await sb.rpc('account_can_manage', { p_business: businessId })
    : await sb.rpc('account_business_access');
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error(businessAccessMessage);
  return auth.user.id;
}
export async function requireOwnedRow(table: string, id: string): Promise<string> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(table).select('business_id').eq('id', id).single();
  if (error || !data?.business_id) throw new Error(businessAccessMessage);
  await requireBusinessAccess(data.business_id);
  return data.business_id;
}
export async function businessAccessError(businessId?: string, expectedUserId?: string): Promise<string | null> {
  try { await requireBusinessAccess(businessId, expectedUserId); return null; } catch (reason) { return accessError(reason); }
}
export async function ownedRowAccessError(table: string, id: string): Promise<string | null> {
  try { await requireOwnedRow(table, id); return null; } catch (reason) { return accessError(reason); }
}
export function accessError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Yetki doğrulanamadı. Tekrar deneyin.';
}

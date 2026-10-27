import { getSupabaseClient } from '@/template';
import { requireBusinessAccess, accessError } from './accountAccessService';
export interface BusinessRegistration { main_category: string; category: string; name: string; description: string; phone: string; address: string; hours: string }
export async function registerBusiness(form: BusinessRegistration): Promise<{ error: string | null }> {
 try {
  const userId = await requireBusinessAccess();
  if (!form.name.trim()) throw new Error('İşletme adını girin.');
  const { error } = await getSupabaseClient().from('businesses').insert({ ...form, name: form.name.trim(), owner_id: userId });
  return { error: error?.message ?? null };
 } catch (reason) { return { error: accessError(reason) }; }
}

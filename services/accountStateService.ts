import { getSupabaseClient } from '@/template';
export async function loadCustomerAccess(): Promise<boolean> {
 const { data, error } = await getSupabaseClient().rpc('account_customer');
 if (error) throw new Error(error.message);
 return data === true;
}

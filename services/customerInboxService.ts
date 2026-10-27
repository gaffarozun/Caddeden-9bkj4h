import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from './requestTimeoutService';
export interface CustomerNotification { id: string; kind: string; title: string; body: string; business_id: string | null; order_id: string | null; request_id: string | null; created_at: string; read_at: string | null }
export async function fetchCustomerInbox(): Promise<CustomerNotification[]> {
 const { data,error } = await withRequestTimeout(getSupabaseClient().rpc('customer_inbox_items'), 'Bildirimler yüklenemedi.');
 if (error) throw new Error(error.message);
 return Array.isArray(data) ? data : [];
}
export async function readCustomerNotification(id: string): Promise<void> {
 const { error } = await withRequestTimeout(getSupabaseClient().rpc('customer_inbox_read',{p_id:id}), 'Bildirim okundu olarak işaretlenemedi.');
 if (error) throw new Error(error.message);
}

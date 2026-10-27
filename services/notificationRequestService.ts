// Powered by OnSpace.AI
// Business notification requests: a business asks to send an announcement
// (count, time range, weekdays) under an admin-set price. Every request requires
// admin approval before the notification is actually published to users.
// status/payment_status are forced server-side (protect_notification_request_insert).
import { getSupabaseClient } from '@/template';
import { businessAccessError, ownedRowAccessError } from './accountAccessService';

const sb = () => getSupabaseClient();

export interface MyNotificationRequest {
  id: string;
  business_id: string;
  title: string;
  body: string;
  target_category: string | null;
  send_count: number;
  time_start: string | null;
  time_end: string | null;
  days: number[];
  price: number;
  payment_status: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  businesses?: { name?: string; category?: string } | null;
}

export async function createNotificationRequest(params: {
  business_id: string;
  package_id?: string | null;
  price?: number;
  title: string;
  body: string;
  target_category?: string | null;
  send_count: number;
  time_start?: string | null;
  time_end?: string | null;
  days: number[];
}): Promise<{ error: string | null }> {
  const denied = await businessAccessError(params.business_id); if (denied) return { error: denied };
  const { error } = await sb().from('notification_requests').insert({
    business_id: params.business_id,
    package_id: params.package_id ?? null,
    price: params.price ?? 0,
    title: params.title,
    body: params.body,
    target_category: params.target_category ?? null,
    send_count: params.send_count,
    time_start: params.time_start ?? null,
    time_end: params.time_end ?? null,
    days: params.days,
  });
  return { error: error?.message ?? null };
}

export async function listMyNotificationRequests(
  ownerId: string
): Promise<{ data: MyNotificationRequest[]; error: string | null }> {
  const denied = await businessAccessError(undefined, ownerId); if (denied) return { data: [], error: denied };
  const { data, error } = await sb()
    .from('notification_requests')
    .select('*, businesses!inner(name, category, owner_id)')
    .eq('businesses.owner_id', ownerId)
    .order('created_at', { ascending: false });
  return { data: (data as MyNotificationRequest[]) ?? [], error: error?.message ?? null };
}

export async function deleteNotificationRequest(id: string): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('notification_requests', id); if (denied) return { error: denied };
  const { error } = await sb().from('notification_requests').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export function notifRequestStatusMeta(
  status?: string
): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (status === 'approved') return { label: 'Onaylandı · Gönderildi', tone: 'success' };
  if (status === 'rejected') return { label: 'Reddedildi', tone: 'danger' };
  return { label: 'Onay bekliyor', tone: 'warning' };
}

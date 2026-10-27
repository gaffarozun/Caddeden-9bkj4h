import { getSupabaseClient } from '@/template';
import { listMyOrders, listMyReservations } from './businessRequestService';

export interface OwnedBusiness {
  id: string;
  name: string;
  category: string;
  approval_status: string;
  is_published: boolean;
}

export async function loadProfileOverview(userId: string, role: string = 'user') {
  const [businesses, reservations, orders] = await Promise.all([
    role === 'business' || role === 'admin' ? getSupabaseClient().from('businesses').select('id, name, category, approval_status, is_published').eq('owner_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    role === 'user' ? listMyReservations(userId) : Promise.resolve({ data: [], error: null }),
    role === 'user' ? listMyOrders(userId) : Promise.resolve({ data: [], error: null }),
  ]);
  if (businesses.error) throw new Error(businesses.error.message);
  if (reservations.error || orders.error) throw new Error(reservations.error || orders.error || 'Profil bilgileri yüklenemedi.');
  return { owned: (businesses.data ?? []) as OwnedBusiness[], reservations: reservations.data, orders: orders.data };
}

// Powered by OnSpace.AI
// Orders & reservations between users and businesses. Both flow through real DB
// tables with RLS: the customer creates a request; the business owner approves
// or rejects it. Customer contact + delivery location live on the order row so
// the business can read them (user_profiles rows are private via RLS).
import { getSupabaseClient } from '@/template';
import { requireCustomer, accessError, businessAccessError, ownedRowAccessError } from './accountAccessService';

const sb = () => getSupabaseClient();

export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = RequestStatus | 'on_the_way' | 'delivered';

export interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
}

export interface OrderRow {
  id: string;
  user_id: string;
  business_id: string;
  note: string | null;
  items: OrderItem[];
  total: number;
  status: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  businesses?: { name?: string } | null;
}

export interface ReservationRow {
  id: string;
  user_id: string;
  business_id: string;
  type: string;
  date: string;
  time: string;
  guests: number;
  service_id: string | null;
  status: string;
  customer_name: string | null;
  phone: string | null;
  created_at: string;
  businesses?: { name?: string } | null;
}

// Resolve a business owner id so the UI can enforce role separation (an owner
// cannot place customer orders/reservations on their own business).
export async function getBusinessOwnerId(id: string): Promise<string | null> {
  const { data } = await sb().from('businesses').select('owner_id').eq('id', id).maybeSingle();
  return (data as { owner_id?: string } | null)?.owner_id ?? null;
}

// ---------------- Orders ----------------

export async function placeOrder(params: {
  business_id: string;
  items: OrderItem[];
  total: number;
  phone: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
  customer_name?: string | null;
}): Promise<{ error: string | null }> {
  let uid: string;
  try { uid = await requireCustomer(); } catch (reason) { return { error: accessError(reason) }; }
  const { data: open, error: openError } = await sb().rpc('business_is_open', { p_business: params.business_id });
  if (openError || open !== true) return { error: openError?.message ?? 'İşletme kapalı. Açılana kadar sipariş verilemez.' };
  const { error } = await sb().from('orders').insert({
    user_id: uid,
    business_id: params.business_id,
    items: params.items,
    total: params.total,
    phone: params.phone,
    address: params.address,
    lat: params.lat ?? null,
    lng: params.lng ?? null,
    note: params.note ?? null,
    customer_name: params.customer_name ?? null,
  });
  return { error: error?.message ?? null };
}

// A customer's own orders for one business (drives the per-item button state).
export async function listMyOrdersForBusiness(
  businessId: string,
  userId: string
): Promise<{ data: OrderRow[]; error: string | null }> {
  const { data, error } = await sb()
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: (data as OrderRow[]) ?? [], error: error?.message ?? null };
}

// All of a customer's orders (profile history).
export async function listMyOrders(userId: string): Promise<{ data: OrderRow[]; error: string | null }> {
  const { data, error } = await sb()
    .from('orders')
    .select('*, businesses(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: (data as OrderRow[]) ?? [], error: error?.message ?? null };
}

// Incoming orders for every business owned by the caller (business panel).
export async function listIncomingOrders(ownerId: string): Promise<{ data: OrderRow[]; error: string | null }> {
  const denied = await businessAccessError(undefined, ownerId);
  if (denied) return { data: [], error: denied };
  const { data, error } = await sb()
    .from('orders')
    .select('*, businesses!inner(name, owner_id)')
    .eq('businesses.owner_id', ownerId)
    .order('created_at', { ascending: false });
  return { data: (data as OrderRow[]) ?? [], error: error?.message ?? null };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('orders', orderId); if (denied) return { error: denied };
  const { data, error } = await sb().from('orders').update({ status }).eq('id', orderId).select('id').maybeSingle();
  return { error: error?.message ?? (!data ? 'Sipariş bulunamadı veya yetkiniz değişti.' : null) };
}

// ---------------- Reservations / appointments ----------------

export async function createReservation(params: {
  business_id: string;
  date: string;
  time: string;
  guests: number;
  phone: string;
  service_id?: string | null;
  type?: string;
  customer_name?: string | null;
}): Promise<{ error: string | null }> {
  let uid: string;
  try { uid = await requireCustomer(); } catch (reason) { return { error: accessError(reason) }; }
  const { error } = await sb().from('reservations').insert({
    user_id: uid,
    business_id: params.business_id,
    date: params.date,
    time: params.time,
    guests: params.guests,
    phone: params.phone,
    service_id: params.service_id ?? null,
    type: params.type ?? 'reservation',
    customer_name: params.customer_name ?? null,
  });
  return { error: error?.message ?? null };
}

export async function listMyReservations(userId: string): Promise<{ data: ReservationRow[]; error: string | null }> {
  const { data, error } = await sb()
    .from('reservations')
    .select('*, businesses(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: (data as ReservationRow[]) ?? [], error: error?.message ?? null };
}

export async function listIncomingReservations(
  ownerId: string
): Promise<{ data: ReservationRow[]; error: string | null }> {
  const denied = await businessAccessError(undefined, ownerId); if (denied) return { data: [], error: denied };
  const { data, error } = await sb()
    .from('reservations')
    .select('*, businesses!inner(name, owner_id)')
    .eq('businesses.owner_id', ownerId)
    .order('created_at', { ascending: false });
  return { data: (data as ReservationRow[]) ?? [], error: error?.message ?? null };
}

export async function updateReservationStatus(
  id: string,
  status: RequestStatus
): Promise<{ error: string | null }> {
  const denied = await ownedRowAccessError('reservations', id); if (denied) return { error: denied };
  const { data, error } = await sb().from('reservations').update({ status }).eq('id', id).select('id').maybeSingle();
  return { error: error?.message ?? (!data ? 'Talep bulunamadı veya yetkiniz değişti.' : null) };
}

export function requestStatusMeta(status?: string): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (status === 'delivered') return { label: 'Teslim edildi', tone: 'success' };
  if (status === 'on_the_way') return { label: 'Yola çıktı', tone: 'warning' };
  if (status === 'approved') return { label: 'Onaylandı', tone: 'success' };
  if (status === 'rejected') return { label: 'Reddedildi', tone: 'danger' };
  return { label: 'Onay bekliyor', tone: 'warning' };
}

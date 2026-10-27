import { useCallback, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { OrderRow, OrderStatus, ReservationRow, RequestStatus, listIncomingOrders, listIncomingReservations, updateOrderStatus, updateReservationStatus } from '@/services/businessRequestService';
export type RequestSection = 'orders' | 'reservations' | 'appointments';
export function useBusinessRequests(initialSection: RequestSection = 'orders') {
  const { authUser } = useAuth(); const [orders, setOrders] = useState<OrderRow[]>([]); const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [section, setSection] = useState<RequestSection>(initialSection); const [filter, setFilter] = useState('pending');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [busy, setBusy] = useState('');
  const version = useRef(0); const lock = useRef(false);
  const load = useCallback(async () => {
    const generation = ++version.current;
    if (!authUser || !['business','admin'].includes(authUser.role)) { setOrders([]); setReservations([]); setLoading(false); return; }
    const [o, r] = await Promise.all([listIncomingOrders(authUser.id), listIncomingReservations(authUser.id)]);
    if (generation !== version.current) return;
    if (o.error || r.error) { setError(o.error || r.error || 'Talepler yüklenemedi.'); setOrders([]); setReservations([]); }
    else { setError(''); setOrders(o.data); setReservations(r.data); }
    setLoading(false); setRefreshing(false);
  }, [authUser?.id, authUser?.role]);
  useFocusEffect(useCallback(() => {
    setSection(initialSection); setOrders([]); setReservations([]); setLoading(true); void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 15000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { version.current += 1; clearInterval(timer); sub.remove(); };
  }, [load, initialSection]));
  const setStatus = useCallback(async (kind: 'order' | 'booking', id: string, status: OrderStatus | RequestStatus) => {
    if (lock.current) return; lock.current = true; setBusy(id); setError('');
    try { const result = kind === 'order' ? await updateOrderStatus(id, status as OrderStatus) : await updateReservationStatus(id, status as RequestStatus);
      if (result.error) setError(result.error); else await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Durum güncellenemedi.'); }
    finally { setBusy(''); lock.current = false; }
  }, [load]);
  const link = useCallback(async (url: string) => { try { await Linking.openURL(url); } catch { setError('Bu bağlantı cihazınızda açılamadı.'); } }, []);
  const refresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);
  const data = (section === 'orders' ? orders : reservations.filter(row => section === 'appointments' ? row.type === 'appointment' : row.type !== 'appointment')).filter(row => filter === 'all' || row.status === filter);
  return { authUser, data, section, setSection, filter, setFilter, error, loading, refreshing, refresh, busy, setStatus, link };
}

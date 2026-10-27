import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { useBusinessCart } from './useBusinessCart';
import { OrderRow, ReservationRow, listMyOrders, listMyReservations } from '@/services/businessRequestService';
import { isActiveOrder } from '@/services/businessProfileService';

export type HistoryItem = { id: string; kind: 'order'; order: OrderRow } | { id: string; kind: 'reservation'; reservation: ReservationRow };

export function useOrderHistory(businessId: string, initialMode: string, initialSection: string, initialScope = 'all', initialBookingType = 'reservation') {
  const { authUser } = useAuth();
  const { revision } = useBusinessCart();
  const scope = initialScope === 'orders' || initialScope === 'bookings' ? initialScope : 'all';
  const appointment = !!businessId && initialBookingType === 'appointment';
  const bookingLabel = appointment ? 'Randevular' : 'Rezervasyonlar';
  const startingSection = scope === 'orders' ? 'orders' : scope === 'bookings' ? 'reservations' : initialSection === 'reservations' ? 'reservations' : 'orders';
  const startingMode = initialMode === 'active' || initialMode === 'past' ? initialMode : 'all';
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setModeState] = useState<string>(startingMode);
  const [section, setSectionState] = useState<string>(startingSection);
  const request = useRef(0);
  const userId = authUser?.id ?? '';
  const loadedUser = useRef('');

  const load = useCallback(async () => {
    const version = ++request.current;
    if (!userId) { setOrders([]); setReservations([]); setLoading(false); setRefreshing(false); return; }
    try {
      const [o, r] = await Promise.all([listMyOrders(userId), listMyReservations(userId)]);
      if (version !== request.current) return;
      if (o.error || r.error) throw new Error(o.error || r.error || 'Geçmiş yüklenemedi.');
      setOrders(o.data); setReservations(r.data); setError('');
    } catch (reason) {
      if (version === request.current) setError(reason instanceof Error ? reason.message : 'Geçmiş yüklenemedi.');
    } finally {
      if (version === request.current) { setLoading(false); setRefreshing(false); }
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    if (loadedUser.current !== userId) { setOrders([]); setReservations([]); loadedUser.current = userId; }
    setModeState(startingMode); setSectionState(startingSection); setError('');
    setLoading(true); void load();
    const timer = setInterval(() => { if (!AppState.currentState || AppState.currentState === 'active') void load(); }, 15000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { clearInterval(timer); subscription.remove(); request.current += 1; };
  }, [load, userId, revision, startingMode, startingSection, businessId, scope]));

  const scopedOrders = useMemo(() => orders.filter(order => !businessId || order.business_id === businessId), [orders, businessId]);
  const scopedReservations = useMemo(() => reservations.filter(row => (!businessId || row.business_id === businessId) && (!businessId || (appointment ? row.type === 'appointment' : row.type !== 'appointment'))), [reservations, businessId, appointment]);
  const activeCount = useMemo(() => scopedOrders.filter(order => isActiveOrder(order.status)).length, [scopedOrders]);
  const items: HistoryItem[] = useMemo(() => section === 'reservations'
    ? scopedReservations.map(reservation => ({ id: reservation.id, kind: 'reservation' as const, reservation }))
    : scopedOrders.filter(row => mode === 'all' || (mode === 'active' ? isActiveOrder(row.status) : !isActiveOrder(row.status))).map(order => ({ id: order.id, kind: 'order' as const, order })), [section, scopedReservations, scopedOrders, mode]);
  const sectionOptions = useMemo(() => scope === 'orders' ? [{ id: 'orders', label: 'Siparişler' }] : scope === 'bookings' ? [{ id: 'reservations', label: bookingLabel }] : [{ id: 'orders', label: 'Siparişler' }, { id: 'reservations', label: bookingLabel }], [scope, bookingLabel]);
  const setSection = useCallback((value: string) => {
    if (sectionOptions.some(item => item.id === value)) setSectionState(value);
  }, [sectionOptions]);
  const setMode = useCallback((value: string) => {
    if (value === 'all' || value === 'active' || value === 'past') setModeState(value);
  }, []);
  const refresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);
  const title = section === 'reservations' ? appointment ? 'Randevularım' : 'Rezervasyonlarım'
    : mode === 'active' ? 'Aktif siparişlerim' : mode === 'past' ? 'Geçmiş siparişlerim'
    : scope === 'orders' ? 'Siparişlerim' : appointment ? 'Siparişler ve randevular' : 'Siparişler ve rezervasyonlar';

  return { authUser, items, activeCount, reservationCount: scopedReservations.length, orderCount: scopedOrders.length, loading, error, refreshing, refresh, mode, setMode, section, setSection, sectionOptions, bookingLabel, appointment, title };
}

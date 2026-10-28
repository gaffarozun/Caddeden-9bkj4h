import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { loadProfileOverview, OwnedBusiness } from '@/services/profileOverviewService';
import { OrderRow, ReservationRow } from '@/services/businessRequestService';

export function useProfileOverview() {
  const { authUser, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [owned, setOwned] = useState<OwnedBusiness[]>([]);
  const [myOrders, setMyOrders] = useState<OrderRow[]>([]);
  const [myReservations, setMyReservations] = useState<ReservationRow[]>([]);
  const [error, setError] = useState('');
  const loadedUser = useRef('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    if (loadedUser.current !== `${authUser?.id ?? ''}:${authUser?.role ?? ''}`) {
      setOwned([]); setMyOrders([]); setMyReservations([]);
      loadedUser.current = `${authUser?.id ?? ''}:${authUser?.role ?? ''}`;
    }
    if (authUser) {
      void loadProfileOverview(authUser.id, authUser.role).then(data => {
        if (!active) return;
        setOwned(data.owned); setMyOrders(data.orders); setMyReservations(data.reservations);
      }).catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Profil bilgileri yüklenemedi.');
      });
    }
    return () => { active = false; };
  }, [authUser?.id, authUser?.role]));
  // Elle yenileme: hesap/rol bilgisini ve sipariş, rezervasyon, işletme listelerini yeniden okur.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true); setError('');
    try {
      await refreshProfile();
      if (authUser) {
        const data = await loadProfileOverview(authUser.id, authUser.role);
        setOwned(data.owned); setMyOrders(data.orders); setMyReservations(data.reservations);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Profil bilgileri yenilenemedi.');
    } finally { setRefreshing(false); }
  }, [authUser?.id, authUser?.role, refreshProfile, refreshing]);
  return { owned, myOrders, myReservations, error, refresh, refreshing };
}

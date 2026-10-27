import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAlert } from '@/template';
import { AdminAccountFilter, AdminUserRow, loadAdminUsers, setAdminUserStatus } from '@/services/adminUsersService';
import { useAdminBusinessApproval } from './useAdminBusinessApproval';

export function useAdminUsers(initialFilter: AdminAccountFilter = 'user') {
  const { showAlert } = useAlert();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [filter, setFilter] = useState<AdminAccountFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const mutation = useRef(false);
  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);
  const load = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const version = ++generation.current;
    const task = (async () => {
      try {
        const result = await loadAdminUsers();
        if (mounted.current && version === generation.current) { setItems(result); setError(''); }
      } catch (reason) {
        if (mounted.current && version === generation.current) setError(reason instanceof Error ? reason.message : 'Hesaplar yüklenemedi.');
      } finally {
        if (mounted.current && version === generation.current) { setLoading(false); setRefreshing(false); }
      }
    })();
    inFlight.current = task;
    void task.finally(() => { if (inFlight.current === task) inFlight.current = null; });
    return task;
  }, []);
  useFocusEffect(useCallback(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; generation.current += 1; inFlight.current = null; };
  }, [load]));
  const refresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);
  const changeStatus = useCallback((item: AdminUserRow, status: 'active' | 'restricted' | 'banned') => {
    if (mutation.current || item.role === 'admin') return;
    const label = status === 'active' ? 'Aktifleştir' : status === 'banned' ? 'Yasakla' : '3 gün kısıtla';
    showAlert(label, `${item.username || item.email || 'Hesap'} için hesap durumu değiştirilsin mi? Hesap türü değişmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: label, onPress: async () => {
        if (mutation.current) return;
        mutation.current = true; setBusy(item.id);
        try { await setAdminUserStatus(item.id, status); await load(); }
        catch (reason) { showAlert('Hesap durumu kaydedilemedi', reason instanceof Error ? reason.message : 'Tekrar deneyin.'); }
        finally { mutation.current = false; if (mounted.current) setBusy(''); }
      } },
    ]);
  }, [load, showAlert]);
  const businessApproval = useAdminBusinessApproval(load);
  const counts = useMemo(() => ({
    user: items.filter(item => item.role === 'user').length,
    business: items.filter(item => item.role === 'business').length,
    admin: items.filter(item => item.role === 'admin').length,
    pending: items.filter(item => item.role === 'business' && item.business_account_approval?.status !== 'approved').length,
  }), [items]);
  const visible = useMemo(() => items.filter(item => item.role === filter), [items, filter]);
  return { visible, counts, filter, setFilter, loading, refreshing, error, refresh, changeStatus, businessApproval, busy: !!busy || !!businessApproval.busy };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useUniversity } from '@/hooks/useUniversity';
import { fetchAdminUniversityMessages, moderateUniversityMessage, withdrawUniversityMessage, UniversityAdminMessage, UniversityAdminFilter } from '@/services/universityService';
import { useAlert } from '@/template';

export function useUniversityAdmin() {
  const { invalidate, removeFromFeed } = useUniversity();
  const { showAlert } = useAlert();
  const [status, setStatus] = useState<UniversityAdminFilter>('pending');
  const [items, setItems] = useState<UniversityAdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<UniversityAdminMessage | null>(null);
  const [reason, setReason] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  const sequence = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current += 1; }; }, []);
  const load = useCallback(async (isRefresh = false) => {
    const request = ++sequence.current;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const rows = await fetchAdminUniversityMessages(status);
      if (mounted.current && request === sequence.current) { setItems(rows); setError(''); }
    } catch (reason) { if (mounted.current && request === sequence.current) setError(reason instanceof Error ? reason.message : 'Yazılar yüklenemedi.'); }
    finally { if (mounted.current && request === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, [status]);
  useFocusEffect(useCallback(() => { void load(); return () => { sequence.current += 1; }; }, [load]));
  const changeStatus = useCallback((value: UniversityAdminFilter) => {
    if (lock.current) return;
    sequence.current += 1; setStatus(value); setItems([]); setSelected(null); setReason(''); setError('');
  }, []);
  const decide = useCallback(async (item: UniversityAdminMessage, decision: 'approved' | 'rejected', explanation = '') => {
    if (lock.current || item.withdrawn_at) return;
    sequence.current += 1;
    lock.current = true; setBusyId(item.id); setError('');
    try {
      await moderateUniversityMessage(item, decision, explanation);
      invalidate();
      if (!mounted.current) return;
      setSelected(null); setReason('');
      setItems(previous => previous.filter(value => value.id !== item.id));
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Karar kaydedilemedi. Listeyi yenileyin.'); }
    finally { lock.current = false; if (mounted.current) { setBusyId(''); setLoading(false); setRefreshing(false); } }
  }, [invalidate]);
  const remove = useCallback(async (item: UniversityAdminMessage) => {
    if (lock.current || item.withdrawn_at) return;
    lock.current = true; sequence.current += 1; setBusyId(item.id); setError('');
    try {
      await withdrawUniversityMessage(item.id);
      removeFromFeed(item.id);
      if (mounted.current) { setItems(previous => previous.filter(value => value.id !== item.id)); setSelected(null); }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Yazı kaldırılamadı.'); }
    finally { lock.current = false; if (mounted.current) { setBusyId(''); setLoading(false); setRefreshing(false); } }
  }, [removeFromFeed]);
  const confirmRemove = useCallback((item: UniversityAdminMessage) => {
    if (lock.current || item.withdrawn_at) return;
    showAlert('Altyazıyı kaldır?', 'Yazı Cadde TV akışından ve aktif isteklerden kaldırılır. Kaldırılan yazı tekrar onaylanamaz; işlem geçmişte korunur.', [
      { text: 'Vazgeç', style: 'cancel' }, { text: 'Kaldır', style: 'destructive', onPress: () => { void remove(item); } },
    ]);
  }, [showAlert, remove]);
  const openRejection = useCallback((item: UniversityAdminMessage) => { setSelected(item); setReason(''); }, []);
  const closeRejection = useCallback(() => { if (!lock.current) setSelected(null); }, []);
  const reject = useCallback(() => { if (selected) void decide(selected, 'rejected', reason); }, [selected, reason, decide]);
  const refresh = useCallback(() => load(true), [load]);
  return { status, changeStatus, items, loading, refreshing, busyId, error, selected, reason, setReason, decide, openRejection, closeRejection, reject, refresh, confirmRemove };
}

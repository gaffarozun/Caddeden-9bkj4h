import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAccountAccess } from '@/hooks/useAccountAccess';
import { useUniversity } from '@/hooks/useUniversity';
import { fetchOwnUniversityMessages, normalizeUniversityText, submitUniversityMessage, withdrawUniversityMessage, UniversityMessage } from '@/services/universityService';
import { useAlert } from '@/template';

export function useUniversitySubmission() {
  const { authUser, loading: authLoading, operationLoading } = useAuth();
  const { customer } = useAccountAccess();
  const { revision, invalidate, removeFromFeed } = useUniversity();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [text, setText] = useState('');
  const [items, setItems] = useState<UniversityMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const version = useRef(0);
  const userId = authUser?.id;
  const identity = useRef(userId);
  identity.current = userId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; version.current += 1; }; }, []);
  const load = useCallback(async (isRefresh = false) => {
    const current = ++version.current;
    if (!userId) { setItems([]); setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await fetchOwnUniversityMessages(userId);
      if (mounted.current && current === version.current) { setItems(result); setError(''); }
    } catch (reason) { if (mounted.current && current === version.current) setError(reason instanceof Error ? reason.message : 'İstekler yüklenemedi.'); }
    finally { if (mounted.current && current === version.current) { setLoading(false); setRefreshing(false); } }
  }, [userId]);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current += 1; }; }, [load, revision]));
  useEffect(() => { setText(''); setItems([]); setSuccess(false); setError(''); }, [userId]);
  const changeText = useCallback((value: string) => { setText(value); setSuccess(false); setError(''); }, []);
  const submit = useCallback(async () => {
    if (submitting.current || !customer || operationLoading) return;
    submitting.current = true; setBusy(true); setError(''); setSuccess(false);
    try {
      await submitUniversityMessage(text);
      if (!mounted.current) { invalidate(); return; }
      setText(''); setSuccess(true); invalidate();
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Yazı gönderilemedi.'); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }, [customer, operationLoading, text, invalidate]);
  const remove = useCallback(async (item: UniversityMessage) => {
    if (submitting.current || operationLoading || item.withdrawn_at || item.user_id !== userId) return;
    submitting.current = true; setRemovingId(item.id); setError(''); setSuccess(false);
    version.current += 1;
    try {
      const withdrawnAt = await withdrawUniversityMessage(item.id);
      removeFromFeed(item.id);
      if (mounted.current && identity.current === item.user_id) {
        setItems(previous => previous.map(value => value.id === item.id ? { ...value, withdrawn_at: withdrawnAt, withdrawn_by: item.user_id } : value));
      }
    } catch (reason) { if (mounted.current && identity.current === item.user_id) setError(reason instanceof Error ? reason.message : 'Yazı kaldırılamadı.'); }
    finally {
      submitting.current = false;
      if (mounted.current) { setRemovingId(''); setLoading(false); setRefreshing(false); }
    }
  }, [userId, operationLoading, removeFromFeed]);
  const confirmRemove = useCallback((item: UniversityMessage) => {
    if (submitting.current || operationLoading || item.withdrawn_at) return;
    showAlert('Yazını kaldır?', 'Yazın Cadde TV altyazısından kaldırılır; bekleyen istek varsa iptal edilir. Yeniden yayınlamak için yeni bir istek göndermen gerekir.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Kaldır', style: 'destructive', onPress: () => { void remove(item); } },
    ]);
  }, [showAlert, remove, operationLoading]);
  const refresh = useCallback(() => load(true), [load]);
  const login = useCallback(() => router.push('/auth'), [router]);
  const count = Array.from(normalizeUniversityText(text)).length;
  return { text, changeText, items, loading, refreshing, busy, removingId, confirmRemove, error, success, submit, refresh, login,
    customer, guest: !authUser, authLoading, operationLoading, valid: count >= 4 && count <= 160, count };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { arrangeAdminContent, PaymentFilter, PaymentOrder } from '@/services/adminContentService';
import { useCampaigns } from '@/hooks/useCampaigns';
import { adminApi } from '@/services/adminService';
import { useAlert } from '@/template';

export interface AdminContentRow {
  id: string; kind?: string; type?: string; media_removed_at?: string | null; title?: string | null; caption?: string | null; description?: string | null;
  image_url: string | null; status: string; price?: number; payment_status?: string;
  start_date?: string | null; end_date?: string | null; created_at: string;
  businesses?: { name?: string; category?: string } | null;
}
export function useAdminContent() {
  const { showAlert } = useAlert();
  const { invalidate } = useCampaigns();
  const [section, setSection] = useState<'content' | 'campaign' | 'ad'>('content');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder>('newest');
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState<AdminContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const status = filter === 'all' ? undefined : filter;
      const result = section === 'content' ? await adminApi.listContent(status) : section === 'campaign' ? await adminApi.listCampaigns(status) : await adminApi.listAds(status === 'approved' ? 'active' : status);
      if (!alive.current || request !== sequence.current) return;
      if (result.error) { setItems([]); showAlert('Hata', result.error); return; }
      setItems(((section === 'content' ? result.data?.content : section === 'campaign' ? result.data?.campaigns : result.data?.ads) as AdminContentRow[]) ?? []);
    } catch (reason) { if (alive.current && request === sequence.current) showAlert('Hata', reason instanceof Error ? reason.message : 'İçerikler yüklenemedi.'); }
    finally { if (alive.current && request === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, [filter, section, showAlert]);
  useEffect(() => { setItems([]); setLoading(true); void load(); }, [load]);
  const run = useCallback(async (operation: () => Promise<{ error: string | null }>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await operation();
      if (!alive.current) return;
      if (result.error) { showAlert('İşlem yapılamadı', result.error); return; }
      invalidate(); await load();
    } catch (reason) { if (alive.current) showAlert('Hata', reason instanceof Error ? reason.message : 'İşlem yapılamadı.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [invalidate, load, showAlert]);
  const approve = useCallback((row: AdminContentRow) => {
    if (row.media_removed_at || ((section === 'content' || row.type === 'reels_sponsored') && !row.image_url)) { showAlert('Görsel yok', 'Görsel kaldırılmış. İşletme yeni bir başvuru göndermelidir.'); return; }
    if ((section === 'campaign' || Number(row.price ?? 0) > 0) && (row.payment_status !== 'paid' || Number(row.price ?? 0) <= 0)) { showAlert('Ödeme gerekli', 'Önce belirlenen ücretin ödemesini doğrulayın; ardından yayını onaylayın.'); return; }
    void run(() => section === 'content' ? adminApi.updateContentStatus(row.id, 'approved') : section === 'campaign' ? adminApi.updateCampaignStatus(row.id, 'approved', undefined, row.status, row.payment_status) : adminApi.updateAd(row.id, { status: 'active' }));
  }, [section, run, showAlert]);
  const reject = useCallback((row: AdminContentRow) => showAlert('Yayını reddet', 'Bu içerik reddedilsin veya yayından kaldırılsın mı? Ödeme iadesi yapılmaz.', [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Reddet', style: 'destructive', onPress: () => { void run(() => section === 'content' ? adminApi.updateContentStatus(row.id, 'rejected', 'Yönetici tarafından reddedildi') : section === 'campaign' ? adminApi.updateCampaignStatus(row.id, 'rejected', 'Yönetici tarafından reddedildi', row.status, row.payment_status) : adminApi.updateAd(row.id, { status: 'rejected', rejection_reason: 'Yönetici tarafından reddedildi' })); } },
  ]), [run, section, showAlert]);
  const markPaid = useCallback((row: AdminContentRow) => {
    const paid = row.payment_status === 'paid';
    if (section === 'campaign' && !paid && Number(row.price ?? 0) <= 0) { showAlert('Ücret tanımlanmamış', 'Bu eski başvuru korunur. İşletme, belirlediğiniz ücretli paketle yeniden başvurmalıdır.'); return; }
    showAlert(paid ? 'Ödeme doğrulamasını kaldır' : 'Ödemeyi doğrula', paid ? 'Kampanya yayından çıkarılır ve yeniden onay gerektirir. Bu işlem para iadesi yapmaz; geçmiş ödeme kaydı korunur.' : 'Belirlenen ücretin ödemesini uygulama dışında aldığınızı doğruluyor musunuz? Otomatik tahsilat yapılmaz.', [
      { text: 'Vazgeç', style: 'cancel' }, { text: 'Doğrula', onPress: () => { void run(() => section === 'content' ? adminApi.setContentPaid(row.id, paid ? 'unpaid' : 'paid') : section === 'campaign' ? adminApi.setCampaignPaid(row.id, paid ? 'unpaid' : 'paid', row.status, row.payment_status) : adminApi.updateAd(row.id, { payment_status: paid ? 'unpaid' : 'paid', ...(paid ? { status: 'pending' } : {}) })); } },
    ]);
  }, [run, section, showAlert]);
  const refresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);
  const remove = useCallback((row: AdminContentRow) => {
    if (row.status !== 'rejected') return;
    showAlert('Reddedilmiş içeriği sil', 'İçerik kalıcı olarak silinir; yalnızca bu içerik için yüklenmiş, başka yerde kullanılmayan fotoğraf da kaldırılır. Ödeme geçmişi korunur ve otomatik iade yapılmaz.', [
      { text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => { void run(() => adminApi.deleteRejectedMedia(row.id, section)); } },
    ]);
  }, [section, run, showAlert]);
  const visibleItems = useMemo(() => arrangeAdminContent(items, paymentFilter, paymentOrder), [items, paymentFilter, paymentOrder]);
  return { section, setSection, filter, setFilter, items: visibleItems, total: items.length, paymentFilter, setPaymentFilter, paymentOrder, setPaymentOrder, loading, refreshing, busy, refresh, approve, reject, markPaid, remove };
}

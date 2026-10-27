import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns } from '@/hooks/useCampaigns';
import { AdPackage, MyBusiness, listActivePackagesByTypes, listMyBusinesses } from '@/services/adService';
import { MyCampaign, campaignTitleLimit, createCampaign, deleteCampaign, listMyCampaigns } from '@/services/campaignService';

export function useCampaignSubmission() {
  const { authUser, operationLoading } = useAuth();
  const { invalidate } = useCampaigns();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<MyBusiness[]>([]);
  const [items, setItems] = useState<MyCampaign[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [bizId, setBizId] = useState('');
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<{ uri: string; base64: string } | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [cropVisible, setCropVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    if (!authUser || authUser.role !== 'business') { setLoading(false); return; }
    try {
      const [b, c, p] = await Promise.all([listMyBusinesses(authUser.id), listMyCampaigns(authUser.id), listActivePackagesByTypes(['content_campaign'])]);
      if (!alive.current || sequence.current !== request) return;
      if (b.error || c.error || p.error) throw new Error(b.error || c.error || p.error || 'Başvurular yüklenemedi.');
      const sale = p.data.filter(plan => Number(plan.price) > 0 && plan.duration_days >= 1);
      setBusinesses(b.data); setItems(c.data); setPackages(sale); setError('');
      setBizId(previous => b.data.some(item => item.id === previous) ? previous : b.data[0]?.id ?? '');
      setPlanId(previous => sale.some(item => item.id === previous) ? previous : '');
    } catch (reason) {
      if (alive.current && sequence.current === request) setError(reason instanceof Error ? reason.message : 'Başvurular yüklenemedi.');
    } finally { if (alive.current && sequence.current === request) { setLoading(false); setRefreshing(false); } }
  }, [authUser?.id, authUser?.role]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const selectedPlan = useMemo(() => packages.find(plan => plan.id === planId), [packages, planId]);
  const valid = !!bizId && !!selectedPlan && title.trim().length >= 4 && title.trim().length <= campaignTitleLimit;
  const refresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);
  const pickImage = useCallback(async () => {
    if (busy) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Görsel seçmek için galeri izni gerekli.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.uri && alive.current) { setCropUri(result.assets[0].uri); setCropVisible(true); }
    } catch { if (alive.current) setError('Galeri açılamadı. Tekrar deneyin.'); }
  }, [busy]);
  const submit = useCallback(async () => {
    if (!valid || !selectedPlan || lock.current || operationLoading) return;
    lock.current = true; setBusy(true); setError(''); setSuccess(false);
    try {
      const result = await createCampaign({ business_id: bizId, title: title.trim(), description: description.trim(), base64: picked?.base64, package_id: selectedPlan.id, quotedPrice: Number(selectedPlan.price), quotedDays: selectedPlan.duration_days });
      if (!alive.current) return;
      if (result.error) { setError(result.error); return; }
      setTitle(''); setDescription(''); setPicked(null); setPlanId(''); setSuccess(true); invalidate(); await load();
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Başvuru gönderilemedi.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [valid, selectedPlan, operationLoading, bizId, title, description, picked, invalidate, load]);
  const remove = useCallback((id: string) => {
    if (lock.current) return;
    showAlert('Kampanyayı sil', 'Bu başvuru silinsin mi? Silme işlemi ücret iadesi yapmaz.', [
      { text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true);
        try {
          const result = await deleteCampaign(id);
          if (!alive.current) return;
          if (result.error) { setError(result.error); return; }
          setItems(previous => previous.filter(item => item.id !== id)); invalidate();
        } catch { if (alive.current) setError('Kampanya silinemedi.'); }
        finally { lock.current = false; if (alive.current) setBusy(false); }
      } },
    ]);
  }, [showAlert, invalidate]);
  const finishCrop = useCallback((result: { uri: string; base64: string }) => { setPicked(result); setCropVisible(false); }, []);
  const closeCrop = useCallback(() => setCropVisible(false), []);
  const addBusiness = useCallback(() => router.push('/business/register'), [router]);
  return { businesses, items, packages, bizId, setBizId, planId, setPlanId, title, setTitle, description, setDescription,
    picked, cropUri, cropVisible, loading, refreshing, busy, error, success, selectedPlan, valid,
    disabled: busy || operationLoading, refresh, pickImage, submit, remove, finishCrop, closeCrop, addBusiness };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { useCafePresence } from './useCafePresence';
import { cafeArrivalPollMilliseconds } from '@/services/cafeLocationRules';
import { fetchNearbyCafes, getGrantedCafePosition, NearbyCafe } from '@/services/cafePresenceService';
interface ArrivalPrompt { cafe: NearbyCafe; cafes: NearbyCafe[]; visible: boolean; attempted: boolean }
export function useCafeArrivalController(enabled: boolean) {
 const { authUser, loading, operationLoading, passwordRecovery, profileError } = useAuth();
 const presence = useCafePresence(); const router = useRouter();
 const actor = !loading && !operationLoading && !passwordRecovery && !profileError && authUser?.role === 'user' && authUser.status === 'active' ? authUser.id : '';
 const [prompt, setPrompt] = useState<ArrivalPrompt | null>(null);
 const [status, setStatus] = useState('Konumu kontrol edin.');
 const [checking, setChecking] = useState(false); const [scanRevision, setScanRevision] = useState(0);
 const [checkedAt, setCheckedAt] = useState<number | null>(null);
 const suppressed = useRef(new Map<string, number>()); const confirming = useRef(false);
 const explicitScan = useRef(false); const identity = useRef(0); const latestPresence = useRef(presence);
 latestPresence.current = presence;
 useEffect(() => {
  identity.current++; suppressed.current.clear(); confirming.current = false; explicitScan.current = false;
  setPrompt(null); setCheckedAt(null); setChecking(false); setStatus('Konumu kontrol edin.');
  return () => { identity.current++; };
 }, [actor]);
 useEffect(() => {
  let alive = true; let fetching = false;
  setPrompt(null); setChecking(false);
  if (!enabled || !actor || presence.visit) return;
  const active = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const check = async () => {
   if (!alive || fetching || confirming.current || latestPresence.current.busy || latestPresence.current.visit || !active()) return;
   fetching = true; const manual = explicitScan.current; explicitScan.current = false;
   if (manual) setChecking(true);
   try {
    const position = await getGrantedCafePosition(manual);
    if (!alive || !active() || confirming.current) return;
    if (!position) { setPrompt(null); setCheckedAt(Date.now()); setStatus('Konum izni gerekli.'); return; }
    const cafes = await fetchNearbyCafes(position);
    if (!alive || !active() || confirming.current || latestPresence.current.busy || latestPresence.current.visit) return;
    for (const id of suppressed.current.keys()) if (!cafes.some(cafe => cafe.business_id === id)) suppressed.current.delete(id);
    const available = cafes.filter(cafe => (suppressed.current.get(cafe.business_id) ?? 0) <= Date.now());
    setCheckedAt(Date.now());
    setStatus(available.length ? `${available.length} yakın işletme.` : '50 m içinde işletme bulunamadı.');
    setPrompt(previous => {
     if (!available.length) return null;
     const selected = available.find(cafe => cafe.business_id === previous?.cafe.business_id) ?? available[0];
     return { cafe: selected, cafes: available, visible: previous?.visible ?? false,
      attempted: previous?.cafe.business_id === selected.business_id ? previous.attempted : false };
    });
   } catch (reason) {
    if (alive && !confirming.current) { setPrompt(null); setCheckedAt(Date.now()); setStatus(reason instanceof Error ? reason.message : 'Konum kontrol edilemedi.'); }
   } finally { fetching = false; if (alive) setChecking(false); }
  };
  void check(); const timer = setInterval(() => { void check(); }, cafeArrivalPollMilliseconds);
  const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); else { setPrompt(null); setChecking(false); } });
  return () => { alive = false; clearInterval(timer); subscription.remove(); };
 }, [enabled, actor, presence.visit?.business_id, scanRevision]);
 const scan = useCallback(() => {
  if (confirming.current || latestPresence.current.busy || checking) return;
  if (!actor) { setStatus('Müşteri hesabıyla giriş yapın.'); return; }
  if (latestPresence.current.visit) { setStatus('Mekân katılımınız aktif.'); return; }
  if (!enabled) { setStatus('Bu ekrandan çıkıp yeniden deneyin.'); return; }
  suppressed.current.clear(); explicitScan.current = true; setScanRevision(value => value + 1);
 }, [actor, enabled, checking]);
 const openSettings = useCallback(async () => {
  if (Platform.OS === 'web') { setStatus('Tarayıcı site ayarlarından konuma izin verin.'); return; }
  try { await Linking.openSettings(); } catch { setStatus('Cihaz ayarlarından konum iznini açın.'); }
 }, []);
 const choose = useCallback((visible: boolean) => {
  if (!confirming.current) setPrompt(previous => previous ? { ...previous, visible, attempted: false } : null);
 }, []);
 const selectCafe = useCallback((businessId: string) => {
  if (confirming.current || latestPresence.current.busy) return;
  setPrompt(previous => {
   const cafe = previous?.cafes.find(item => item.business_id === businessId);
   return previous && cafe ? { ...previous, cafe, attempted: false } : previous;
  });
 }, []);
 const dismiss = useCallback(() => {
  if (!prompt || confirming.current) return;
  const until = Date.now() + 30 * 60000;
  prompt.cafes.forEach(cafe => suppressed.current.set(cafe.business_id, until));
  setPrompt(null); setStatus('Öneriler kapatıldı.');
 }, [prompt]);
 const openVenue = useCallback(() => {
  if (!prompt || confirming.current) return;
  const id = prompt.cafe.business_id; dismiss(); router.push(`/business/${id}`);
 }, [prompt, dismiss, router]);
 const confirm = useCallback(async () => {
  if (!prompt || confirming.current || presence.busy || !actor) return;
  confirming.current = true; const version = identity.current; const businessId = prompt.cafe.business_id;
  setPrompt(previous => previous ? { ...previous, attempted: true } : null);
  try {
   // join reacquires current GPS and validates the selected venue on the server.
   const joined = await presence.join(businessId, prompt.cafe.social_enabled && presence.profileEnabled && prompt.visible);
   if (version !== identity.current) return;
   if (joined) { suppressed.current.set(businessId, Date.now() + 30 * 60000); setPrompt(null); setStatus('Konum doğrulandı.'); router.push(`/business/${businessId}`); }
  } finally { if (version === identity.current) confirming.current = false; }
 }, [prompt, actor, presence.busy, presence.join, presence.profileEnabled, router]);
 const show = enabled && !!actor && !presence.visit;
 return { cafe: show ? prompt?.cafe ?? null : null, cafes: show ? prompt?.cafes ?? [] : [], selectCafe,
  visible: prompt?.visible ?? false, profileEnabled: presence.profileEnabled, busy: presence.busy,
  error: prompt?.attempted ? presence.error : '', checking, status, checkedAt, scan, openSettings, choose, dismiss, openVenue, confirm };
}
export type CafeArrivalController = ReturnType<typeof useCafeArrivalController>;

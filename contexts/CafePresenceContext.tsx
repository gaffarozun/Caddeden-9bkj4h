import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { CafeVisit, fetchMyCafeVisit, refreshCafeLocation, isCafeVisitLive, joinCafe, leaveCafe, setCafePhotoVisibility, cafePollMilliseconds } from '@/services/cafePresenceService';
import { fetchMyCafePhotoPath, pickAndUploadCafePhoto } from '@/services/cafePhotoService';
import { fetchVenueProfilePreference, saveVenueProfilePreference } from '@/services/venueProfilePreferenceService';
export interface CafePresenceState {
  visit: CafeVisit | null; photoPath: string | null; busy: boolean; error: string; notice: string; revision: number;
  join: (businessId: string, visible: boolean) => Promise<boolean>;
  setVisible: (visible: boolean) => Promise<boolean>; leave: () => Promise<boolean>; upload: () => Promise<boolean>;
  invalidateRoom: () => void;
  profileEnabled: boolean; profilePreferenceReady: boolean; setProfileEnabled: (visible: boolean) => Promise<boolean>;
}
export const CafePresenceContext = createContext<CafePresenceState | undefined>(undefined);
export function CafePresenceProvider({ children }: { children: ReactNode }) {
  const { authUser, loading, passwordRecovery, profileError } = useAuth();
  const userId = !loading && !passwordRecovery && !profileError && authUser?.status === 'active' ? authUser.id : '';
  const customer = authUser?.role === 'user';
  const [visit, setVisit] = useState<CafeVisit | null>(null);
  const [owner, setOwner] = useState(''); const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0); const [now, setNow] = useState(Date.now());
  const [profileEnabled, setProfileEnabledState] = useState(false); const [profilePreferenceReady, setProfilePreferenceReady] = useState(false);
  const epoch = useRef(0); const sequence = useRef(0); const locked = useRef(false);
  const applyVisit = useCallback((next: CafeVisit | null) => { setVisit(next); }, []);
  useEffect(() => {
    let alive = true; let fetching = false; const version = ++epoch.current;
    locked.current = false; setOwner(userId); applyVisit(null); setPhotoPath(null); setBusy(false); setError(''); setNotice('');
    setProfileEnabledState(false); setProfilePreferenceReady(false); sequence.current++;
    if (!userId) return;
    if (customer) void fetchVenueProfilePreference().then(value => { if (alive && version === epoch.current) { setProfileEnabledState(value); setProfilePreferenceReady(true); } }).catch(reason => { if (alive && version === epoch.current) setError(reason instanceof Error ? reason.message : 'Profil gizliliği yüklenemedi.'); });
    void fetchMyCafePhotoPath(userId).then(path => { if (alive && version === epoch.current) setPhotoPath(path); }).catch(() => {});
    const load = async () => {
      setNow(Date.now());
      if (!alive || locked.current || fetching || AppState.currentState !== 'active' || !customer) return;
      fetching = true; const ticket = sequence.current;
      try {
        const stored = await fetchMyCafeVisit();
        if (!alive || locked.current || version !== epoch.current || ticket !== sequence.current) return;
        const next = stored ? await refreshCafeLocation(stored.business_id) : null;
        if (alive && version === epoch.current && ticket === sequence.current) applyVisit(next);
      }
      catch { if (alive && version === epoch.current && ticket === sequence.current) applyVisit(null); }
      finally { fetching = false; }
    };
    void load(); const timer = setInterval(() => { void load(); }, cafePollMilliseconds);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { alive = false; epoch.current++; clearInterval(timer); sub.remove(); };
  }, [userId, customer, applyVisit]);
  const run = useCallback(async (task: () => Promise<void | boolean>, message: string) => {
    if (!userId || locked.current) return false;
    locked.current = true; const version = epoch.current; sequence.current++; setBusy(true); setError(''); setNotice('');
    try {
      const result = await task(); if (version !== epoch.current || result === false) return false;
      setNow(Date.now()); setRevision(value => value + 1); setNotice(message); return true;
    } catch (reason) {
      if (version === epoch.current) setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı.');
      return false;
    } finally { if (version === epoch.current) { locked.current = false; setBusy(false); } }
  }, [userId]);
  const join = useCallback((businessId: string, visible: boolean) => run(async () => {
    const version = epoch.current; const next = await joinCafe(businessId, visible);
    if (version === epoch.current) applyVisit(next);
  }, visible ? 'Mekâna katıldınız. Fotoğrafınız bu mekândaki katılımcılara açık.' : 'Mekâna katıldınız. Fotoğrafınız diğer katılımcılara gizli.'), [run, applyVisit]);
  const setVisible = useCallback((visible: boolean) => run(async () => {
    const version = epoch.current;
    const next = await setCafePhotoVisibility(visible);
    if (version === epoch.current) applyVisit(next);
  }, visible ? 'Fotoğrafınız bu mekândaki katılımcılara gösteriliyor.' : 'Fotoğrafınız diğer katılımcılardan gizlendi.'), [run, applyVisit]);
  const leave = useCallback(() => run(async () => {
    const version = epoch.current; await leaveCafe(); if (version === epoch.current) applyVisit(null);
  }, 'Mekân katılımınız sonlandırıldı.'), [run, applyVisit]);
  const upload = useCallback(() => run(async () => {
    const version = epoch.current; const path = await pickAndUploadCafePhoto(userId);
    if (!path) return false;
    if (version === epoch.current) setPhotoPath(path);
  }, 'Profil fotoğrafınız kaydedildi.'), [run, userId]);
  const setProfileEnabled = useCallback((visible: boolean) => run(async () => {
    const version = epoch.current; await saveVenueProfilePreference(visible);
    if (version === epoch.current) { setProfileEnabledState(visible); setProfilePreferenceReady(true); if (!visible) setVisit(previous => previous ? { ...previous, photo_visible: false } : null); }
  }, visible ? 'Genel profil görünürlüğü açıldı. Bu girişte Göster seçeneğini ayrıca seçebilirsiniz.' : 'İsminiz ve fotoğrafınız gizlendi; mekânda yalnızca Kullanıcı olarak görünürsünüz.'), [run]);
  const invalidateRoom = useCallback(() => { setRevision(value => value + 1); }, []);
  const current = owner === userId && isCafeVisitLive(visit, now) ? visit : null;
  const value = useMemo<CafePresenceState>(() => ({ visit: current, photoPath: owner === userId ? photoPath : null, busy, error, notice, revision, join, setVisible, leave, upload, invalidateRoom, profileEnabled: owner === userId && profileEnabled, profilePreferenceReady: owner === userId && profilePreferenceReady, setProfileEnabled }), [profileEnabled, profilePreferenceReady, setProfileEnabled, current, photoPath, owner, userId, busy, error, notice, revision, join, setVisible, leave, upload, invalidateRoom]);
  return <CafePresenceContext.Provider value={value}>{children}</CafePresenceContext.Provider>;
}

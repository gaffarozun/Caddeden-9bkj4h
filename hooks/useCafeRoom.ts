import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { useCafePresence } from './useCafePresence';
import { useCafeSocial } from './useCafeSocial';
import { isInstagramHandleValid } from '@/services/cafeSocialService';
import { cafePollMilliseconds, CafeRoom, fetchCafeRoom, isCafeRoomLocal, setCafeRoomEnabled } from '@/services/cafePresenceService';
export function useCafeRoom(businessId: string, manage = false) {
  const { authUser } = useAuth(); const presence = useCafePresence(); const social = useCafeSocial();
  const [room, setRoom] = useState<CafeRoom | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const generation = useRef(0); const lock = useRef(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let alive = true; let fetching = false; const version = ++generation.current;
    setRoom(null); setError(''); setBusy(false); lock.current = false;
    const load = async () => {
      if (!alive || fetching || lock.current || AppState.currentState !== 'active') return;
      fetching = true;
      try { const next = await fetchCafeRoom(businessId); if (alive && version === generation.current) { setRoom(next); setError(''); } }
      catch (reason) { if (alive && version === generation.current) { setRoom(null); setError(reason instanceof Error ? reason.message : 'Kafe bilgileri yüklenemedi.'); } }
      finally { fetching = false; }
    };
    void load(); const timer = setInterval(() => { void load(); }, cafePollMilliseconds);
    const sub = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state === 'active') void load(); else setRoom(previous => previous ? { ...previous, members: [], tables: manage ? previous.tables : [], plan_visible: manage ? previous.plan_visible : false } : null); });
    return () => { alive = false; generation.current++; clearInterval(timer); sub.remove(); };
  }, [businessId, authUser?.id, authUser?.role, presence.revision, presence.visit?.photo_visible, presence.visit?.business_id, social.revision, manage]);
  const toggleEnabled = useCallback(async (enabled: boolean) => {
    if (!manage || lock.current) return;
    lock.current = true; setBusy(true); setError(''); const version = generation.current;
    try {
      await setCafeRoomEnabled(businessId, enabled);
      const next = await fetchCafeRoom(businessId);
      if (version === generation.current) setRoom(next);
    } catch (reason) { if (version === generation.current) setError(reason instanceof Error ? reason.message : 'Ayar kaydedilemedi.'); }
    finally { if (version === generation.current) { setBusy(false); lock.current = false; } }
  }, [businessId, manage]);
  // Both the server visit and local visit must be current; do not keep plans/photos after leave or expiry.
  const local = foreground && isCafeRoomLocal(room, presence.visit, businessId);
  const members = local && room?.enabled && social.ready && isInstagramHandleValid(social.handle) ? room.members : [];
  const visibleRoom = room ? { ...room, members, mine: local ? room.mine : null, tables: manage || local ? room.tables : [], plan_visible: !!room.plan_visible && (manage || local), occupancy_visible: !!room.occupancy_visible, occupancy_percent: room.occupancy_percent } : null;
  return { room: visibleRoom, members, local, busy, error, toggleEnabled, presence };
}

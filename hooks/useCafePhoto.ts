import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useCafePresence } from './useCafePresence';
import { useCafeSocial } from './useCafeSocial';
import { cafePollMilliseconds } from '@/services/cafePresenceService';
import { useAuth } from './useAuth';
import { downloadCafePhoto } from '@/services/cafePhotoService';
export function useCafePhoto(path: string | null) {
  const { authUser } = useAuth();
  const presence = useCafePresence(); const social = useCafeSocial();
  const permissionKey = `${authUser?.id}:${presence.visit?.business_id ?? ''}:${presence.visit?.photo_visible}:${presence.revision}:${social.revision}`;
  const [photo, setPhoto] = useState<{ path: string; owner: string; key: string; uri: string } | null>(null);
  useEffect(() => {
    let alive = true; let fetching = false; let sequence = 0;
    setPhoto(null);
    const load = async () => {
      if (!alive || fetching || !path || !authUser || AppState.currentState !== 'active') return;
      fetching = true; const ticket = sequence;
      try { const uri = await downloadCafePhoto(path); if (alive && ticket === sequence) setPhoto({ path, owner: authUser.id, key: permissionKey, uri }); }
      catch { if (alive) setPhoto(null); } finally { fetching = false; }
    };
    void load(); const timer = setInterval(() => { void load(); }, cafePollMilliseconds);
    const sub = AppState.addEventListener('change', state => { sequence++; if (state === 'active') void load(); else setPhoto(null); });
    return () => { alive = false; sequence++; clearInterval(timer); sub.remove(); };
  }, [path, authUser?.id, permissionKey]);
  return photo?.path === path && photo?.owner === authUser?.id && photo?.key === permissionKey ? photo.uri : null;
}

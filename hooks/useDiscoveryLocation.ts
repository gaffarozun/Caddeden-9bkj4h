import { useCallback, useEffect, useRef, useState } from 'react';
import { DiscoveryPosition, fetchDiscoveryPosition } from '@/services/discoveryLocationService';
export function useDiscoveryLocation() {
 const [position, setPosition] = useState<DiscoveryPosition | null>(null);
 const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const alive = useRef(true); const pending = useRef<Promise<boolean> | null>(null);
 useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 const locate = useCallback((requestPermission = true): Promise<boolean> => {
  if (pending.current) return pending.current;
  setBusy(true); setError('');
  const task = (async () => {
   try {
    const next = await fetchDiscoveryPosition(requestPermission);
    if (!alive.current) return false;
    setPosition(next); return true;
   } catch (reason) {
    if (alive.current) setError(reason instanceof Error ? reason.message : 'Konum alınamadı.');
    return false;
   } finally { pending.current = null; if (alive.current) setBusy(false); }
  })();
  pending.current = task;
  return task;
 }, []);
 const clearError = useCallback(() => setError(''), []);
 return { position, busy, error, locate, clearError };
}

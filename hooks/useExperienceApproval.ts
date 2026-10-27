import { useCallback, useEffect, useRef, useState } from 'react';
import { useRatings } from './useRatings';
export function useExperienceApproval() {
  const { experienceEnabled, experienceLoading, experienceError, setExperienceEnabled, refresh } = useRatings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const setEnabled = useCallback(async (enabled: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await setExperienceEnabled(enabled); if (mounted.current) setNotice(enabled ? 'Müşteri deneyimleri kullanıma açıldı.' : 'Müşteri deneyimleri kapatıldı. Basit yıldız puanlama açık kalır.'); }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Durum değiştirilemedi.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [setExperienceEnabled]);
  const retry = useCallback(() => { setError(''); refresh(); }, [refresh]);
  return { enabled: experienceEnabled, loading: experienceLoading, busy, error: error || experienceError, notice, setEnabled, refresh: retry };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRatings } from './useRatings';
import { useAuth } from './useAuth';
import { isHalfStarRating } from '@/services/ratingService';
import { useAccountAccess } from './useAccountAccess';
export function useBusinessRating(id: string, enabled = true) {
  const { states, load, submit: save, revision, refresh } = useRatings();
  const { authUser } = useAuth(); const access = useAccountAccess();
  const state = states[id];
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(0);
  const dirty = useRef(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { dirty.current = false; setSelected(0); setError(''); setNotice(''); }, [id, authUser?.id]);
  useEffect(() => {
    let active = true;
    if (!enabled || !id) { setLoading(false); return; }
    setLoading(true);
    load(id).then(() => { if (active) setError(''); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Puan bilgisi alınamadı.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, enabled, load, revision]);
  useEffect(() => { if (!dirty.current) setSelected(Number(state?.mine ?? 0)); }, [state?.mine, id]);
  const choose = useCallback((value: number) => { if (lock.current || !isHalfStarRating(value)) return; dirty.current = true; setSelected(value); setError(''); setNotice(''); }, []);
  const submit = useCallback(async () => {
    if (lock.current || !access.customer || !state?.canRate || !isHalfStarRating(selected)) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await save(id, selected);
      if (alive.current) { setNotice('Puanınız kaydedildi. İşletmenin ortalaması güncelleniyor.'); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Puan gönderilemedi.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [id, selected, save, state?.canRate, access.customer]);
  return { state: state ? { ...state, canRate: access.customer && state.canRate } : state, selected, choose, submit, busy, loading, error, notice, signedIn: !!authUser, refresh };
}

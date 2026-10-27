import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from './useFeedback';
export function useFeedbackReply(id: string, kind: 'review' | 'suggestion', initial = '', replyStatus?: string) {
  const { mutate } = useFeedback();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setOpen(false); setText(initial); setError(''); setNotice(''); }, [id, kind]);
  const submit = useCallback(async () => {
    if (locked.current) return;
    if (text.trim().length < 5) { setError('Cevap en az 5 karakter olmalı.'); return; }
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await mutate(`${kind}_reply`, { id, text: text.trim() });
      if (mounted.current) {
        setOpen(false);
        setNotice(kind === 'review' && replyStatus !== 'hidden' ? 'Cevabınız yayımlandı.' : 'Cevabınız yönetici incelemesine gönderildi.');
      }
    }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Cevap gönderilemedi.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, [id, kind, text, replyStatus, mutate]);
  return { open, setOpen, text, setText, busy, error, notice, submit };
}

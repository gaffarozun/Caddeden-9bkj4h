import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from './useFeedback';
import { FeedbackAdminKind, FeedbackAdminRow, feedbackServer, loadAdminFeedback } from '@/services/feedbackService';
export interface DeletionRequest { user_id: string; status: string; created_at: string; completed_at?: string; error_code?: string }
export function useFeedbackAdmin(initialKind: FeedbackAdminKind | 'deletion' = 'review') {
  const { revision, mutate, invalidate } = useFeedback();
  const [kind, setKind] = useState<FeedbackAdminKind | 'deletion'>(initialKind);
  const [items, setItems] = useState<FeedbackAdminRow[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<{ id: string; kind: string; status: string } | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const evidenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setItems([]); setDeletions([]);
    const request = kind === 'deletion' ? feedbackServer<{ requests: DeletionRequest[] }>('deletion_list').then(result => { if (active) setDeletions(result.requests); }) : loadAdminFeedback(kind).then(result => { if (active) setItems(result); });
    request.catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Kayıtlar alınamadı.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, revision]);
  useEffect(() => { setSelected(null); setError(''); setReason(''); setEvidenceUrl(null); }, [kind]);
  useEffect(() => () => { if (evidenceTimer.current) clearTimeout(evidenceTimer.current); }, []);
  const select = useCallback((id: string, itemKind: string, status: string) => { setSelected({ id, kind: itemKind, status }); setReason(''); }, []);
  const submit = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { await mutate(selected.kind === 'complaint' ? 'complaint_status' : 'moderate', { ...selected, reason }); setSelected(null); setReason(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  }, [selected, busy, reason, mutate]);
  const openEvidence = useCallback(async (id: string) => {
    setError('');
    try {
      const { url } = await feedbackServer<{ url: string }>('evidence_url', { id });
      setEvidenceUrl(url);
      if (evidenceTimer.current) clearTimeout(evidenceTimer.current);
      evidenceTimer.current = setTimeout(() => setEvidenceUrl(null), 55000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kanıt açılamadı.'); }
  }, []);
  const resumeDeletion = useCallback(async (id: string) => {
    if (busy) return; setBusy(true); setError('');
    try { await feedbackServer('resume_deletion', { user_id: id }); invalidate(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Silme devam ettirilemedi.'); }
    finally { setBusy(false); }
  }, [busy, invalidate]);
  return { kind, setKind, items, deletions, loading, busy, error, reason, setReason, selected, select, setSelected, submit, evidenceUrl, setEvidenceUrl, openEvidence, resumeDeletion, refresh: invalidate };
}

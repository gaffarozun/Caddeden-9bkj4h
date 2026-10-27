import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './useAuth';
import { useAccountAccess } from './useAccountAccess';
import { useFeedback } from './useFeedback';
import { useRatings } from './useRatings';
import { BusinessFeedback, CriteriaRatings, FeedbackTopic, feedbackTopics, reviewCriteria, summarizeCriteria, removeUnusedEvidence, uploadFeedbackEvidence } from '@/services/feedbackService';

export type FeedbackTab = 'review' | 'suggestion' | 'complaint';
export function useBusinessFeedback(id: string, enabled = true, startWriting = false) {
  const { authUser } = useAuth(); const access = useAccountAccess();
  const { read, mutate, revision, invalidate } = useFeedback();
  const { experienceEnabled, experienceLoading } = useRatings();
  const allowed = enabled && experienceEnabled && !experienceLoading;
  const [data, setData] = useState<BusinessFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sort, setSort] = useState('newest');
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<FeedbackTab>('review');
  const [formOpen, setFormOpen] = useState(false);
  const formOpenRef = useRef(false);
  const openedOnEntry = useRef(false);
  useEffect(() => { formOpenRef.current = formOpen; }, [formOpen]);
  const [criteriaRatings, setCriteriaRatings] = useState<CriteriaRatings>({});
  const criteriaSummary = useMemo(() => summarizeCriteria(criteriaRatings), [criteriaRatings]);
  const [comment, setComment] = useState('');
  const actionLock = useRef(false);
  const setCriteriaRating = useCallback((topic: FeedbackTopic, stars: number) => {
    if (actionLock.current || !Number.isInteger(stars) || stars < 1 || stars > 5) return;
    setCriteriaRatings(previous => ({ ...previous, [topic]: stars }));
    setError('');
  }, []);
  const [suggestionTopic, setSuggestionTopic] = useState('student_discount');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('price');
  const [target, setTarget] = useState({ type: 'business', id });
  const [evidence, setEvidence] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const lastMine = useRef('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    lastMine.current = ''; openedOnEntry.current = false; formOpenRef.current = false; setData(null); setFormOpen(false); setTarget({ type: 'business', id }); setOffset(0); setError(''); setEvidence(null); setCriteriaRatings({}); setComment(''); setNotice('');
  }, [id, authUser?.id, authUser?.role]);
  useEffect(() => {
    let active = true;
    const generation = ++epoch.current;
    if (!allowed || !id) { setLoading(false); setData(null); return; }
    setLoading(true);
    read(id, sort, offset).then(result => {
      if (!active || generation !== epoch.current) return;
      setData(result); setError('');
      const mineKey = `${result.mine?.id ?? ''}:${result.mine?.updated_at ?? ''}`;
      if (mineKey !== lastMine.current && !formOpenRef.current) {
        lastMine.current = mineKey;
        setCriteriaRatings(reviewCriteria(result.mine)); setComment(result.mine?.comment ?? '');
      }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Veriler alınamadı.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, id, read, sort, offset, revision]);
  useEffect(() => { if (!allowed) setFormOpen(false); }, [allowed]);
  const canCustomer = allowed && access.customer && !data?.owner;
  const commentPreview = useMemo(() => (data?.reviews ?? []).filter(review => review.comment.trim().length > 0).slice(0, 2), [data?.reviews]);
  useEffect(() => {
    if (startWriting && canCustomer && data && !loading && !openedOnEntry.current) {
      openedOnEntry.current = true;
      setTab('review');
      setFormOpen(true);
    }
  }, [startWriting, canCustomer, data, loading]);
  const run = useCallback(async (action: string, params: Record<string, unknown>) => {
    if (busy || actionLock.current) return false;
    actionLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await mutate(action, params);
      if (mounted.current) setNotice(action === 'delete_review' ? 'Değerlendirmeniz kaldırıldı.' : action === 'support' ? 'Destek tercihiniz güncellendi.' : action === 'review' ? data?.mine?.status === 'hidden' ? 'Güncellemeniz alındı. Yönetici tarafından gizlenen yorum yeniden incelenecek.' : 'Özellik puanlarınız ve yorumunuz tek değerlendirme olarak yayımlandı.' : 'Kaydınız alındı. Öneriler yönetici incelemesinden sonra yayımlanır.');
      return true;
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı.');
      return false;
    } finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }, [busy, mutate, data?.mine?.status]);
  const pickEvidence = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Kanıt seçmek için galeri izni gerekli.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setEvidence(result.assets[0]);
  }, []);
  const submit = useCallback(async () => {
    if (!canCustomer || busy || actionLock.current) return;
    if (tab === 'review') {
      const missing = feedbackTopics.filter(feature => !criteriaRatings[feature.id]);
      if (criteriaSummary.selected !== feedbackTopics.length) { setError(`Her özellik için yıldız seçin. Eksik: ${missing.map(feature => feature.label).join(', ')}.`); return; }
      const ok = await run('review', { business_id: id, criteria_ratings: criteriaRatings, comment: comment.trim() });
      if (ok) { setFormOpen(false); setOffset(0); }
    } else if (tab === 'suggestion') {
      if (description.trim().length < 5) { setError('Öneri açıklaması en az 5 karakter olmalı.'); return; }
      const ok = await run('suggest', { business_id: id, description, topic: suggestionTopic });
      if (ok) { setFormOpen(false); setDescription(''); }
    } else {
      if (description.trim().length < 10) { setError('Şikâyet açıklaması en az 10 karakter olmalı.'); return; }
      actionLock.current = true; setBusy(true); setError(''); let path: string | null = null;
      try {
        if (evidence) path = await uploadFeedbackEvidence(evidence);
        await mutate('complaint', { target_type: target.type, target_id: target.id, category, description, evidence_path: path });
        if (mounted.current) { setNotice('Şikâyetiniz yöneticiye iletildi. Bildirim, iddianın doğrulandığı anlamına gelmez.'); setDescription(''); setEvidence(null); setFormOpen(false); setTarget({ type: 'business', id }); }
      } catch (reason) {
        if (path) await removeUnusedEvidence(path).catch(() => {});
        if (mounted.current) setError(reason instanceof Error ? reason.message : 'Şikâyet gönderilemedi.');
      } finally { actionLock.current = false; if (mounted.current) setBusy(false); }
    }
  }, [canCustomer, busy, tab, criteriaRatings, criteriaSummary.selected, run, id, comment, description, suggestionTopic, evidence, mutate, target, category]);
  const report = useCallback((type: string, itemId: string) => {
    setTarget({ type, id: itemId }); setTab('complaint'); setCategory('abuse'); setDescription(''); setFormOpen(true); setNotice('');
  }, []);
  const changeTab = useCallback((next: FeedbackTab) => { setTab(next); setFormOpen(false); setDescription(''); setTarget({ type: 'business', id }); setNotice(''); }, [id]);
  const changeSort = useCallback((next: string) => { setOffset(0); setSort(next); }, []);
  return { data, commentPreview, loading, busy, error, notice, sort, setSort: changeSort, offset, setOffset, tab, setTab: changeTab, formOpen, setFormOpen,
    criteriaRatings, criteriaSummary, setCriteriaRating, comment, setComment, suggestionTopic, setSuggestionTopic, description, setDescription, category, setCategory,
    target, evidence, setEvidence, pickEvidence, submit, report, run, canCustomer, experienceEnabled, experienceLoading, signedIn: !!authUser, refresh: invalidate };
}

import { FunctionsHttpError } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/template';

export const feedbackTopics = [
  { id: 'price', label: 'Fiyat' }, { id: 'hygiene', label: 'Hijyen' },
  { id: 'staff', label: 'Personel' }, { id: 'service', label: 'Hizmet kalitesi' },
  { id: 'environment', label: 'Ortam' }, { id: 'variety', label: 'Ürün çeşitliliği' },
] as const;
export type FeedbackTopic = (typeof feedbackTopics)[number]['id'];
export type CriteriaRatings = Partial<Record<FeedbackTopic, number>>;
export function summarizeCriteria(scores: CriteriaRatings) {
  const values = feedbackTopics.map(topic => scores[topic.id] ?? 0).filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  return { selected: values.length, average: values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length * 10) / 10 : 0 };
}
export function reviewCriteria(review: FeedbackReview | null): CriteriaRatings {
  if (!review) return {};
  if (review.criteria_ratings && Object.keys(review.criteria_ratings).length) return { ...review.criteria_ratings };
  const legacyTopic = feedbackTopics.find(topic => topic.id === review.topic);
  return legacyTopic ? { [legacyTopic.id]: review.rating } : {};
}
export const suggestionTopics = [
  { id: 'price', label: 'Fiyatların iyileştirilmesi' }, { id: 'student_discount', label: 'Öğrenci indirimi' },
  { id: 'variety', label: 'Ürün çeşitliliği' }, { id: 'service', label: 'Hizmet kalitesi' },
  { id: 'environment', label: 'Ortam' }, { id: 'hours', label: 'Çalışma saatleri' }, { id: 'other', label: 'Diğer' },
] as const;
export const complaintTopics = [
  { id: 'price', label: 'Fiyat / fiyat bilgisi' }, { id: 'hygiene', label: 'Hijyen' },
  { id: 'staff', label: 'Personel davranışı' }, { id: 'service', label: 'Hizmet kalitesi' },
  { id: 'waiting', label: 'Uzun bekleme süresi' }, { id: 'misleading', label: 'Yanıltıcı bilgi / reklam' },
  { id: 'other', label: 'Diğer' }, { id: 'abuse', label: 'Uygunsuz içerik / hakaret' },
  { id: 'spam', label: 'Spam' }, { id: 'personal_data', label: 'Kişisel bilgi paylaşımı' },
] as const;
export function feedbackTopicLabel(id?: string | null): string {
  return [...feedbackTopics, ...suggestionTopics, ...complaintTopics].find(t => t.id === id)?.label ?? id ?? 'Diğer';
}
export function feedbackStatusLabel(status?: string): string {
  return ({ pending: 'Onay bekliyor', published: 'Yayında', hidden: 'Gizlendi', deleted: 'Silindi', open: 'Bekliyor', reviewing: 'İnceleniyor', resolved: 'Sonuçlandı', dismissed: 'İşleme alınmadı', processing: 'Silme sürüyor', failed: 'Tekrar işlem gerekli', completed: 'Silme tamamlandı' } as Record<string, string>)[status ?? ''] ?? status ?? '';
}
export interface FeedbackReview {
  id: string; rating: number; comment: string; topic: string; created_at: string; updated_at: string;
  author?: string; status?: string; criteria_ratings?: CriteriaRatings; moderation_reason?: string | null; reply?: string | null; reply_status?: string;
}
export interface FeedbackSuggestion {
  id: string; topic: string; description: string; supports: number; supported: boolean; status: string;
  moderation_reason?: string | null; reply?: string | null; reply_status?: string; created_at: string;
}
export interface FeedbackComplaint {
  id: string; feedback_category: string | null; status: string; description: string | null;
  resolution_note: string | null; created_at: string;
}
export interface FeedbackHighlight { topic: string; count: number }
export interface BusinessFeedback {
  owner: boolean; ratings: { rating: number; count: number };
  reviews: FeedbackReview[]; mine: FeedbackReview | null; suggestions: FeedbackSuggestion[]; complaints: FeedbackComplaint[];
  positive: FeedbackHighlight | null; reported: FeedbackHighlight | null; requested: FeedbackHighlight | null;
}
export type FeedbackAdminKind = 'review' | 'complaint' | 'suggestion' | 'summary';
export interface FeedbackAdminRow {
  id: string; business_name?: string; rating?: number; comment?: string; topic?: string; description?: string;
  reason?: string; feedback_category?: string; status: string; moderation_reason?: string; resolution_note?: string;
  reply?: string; reply_status?: string; reply_reason?: string; created_at?: string; updated_at?: string;
  supports?: number; evidence_path?: string; target_type?: string; target_id?: string; summary?: BusinessFeedback;
}
async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}
export const loadBusinessFeedback = (id: string, sort: string, offset = 0) =>
  rpc<BusinessFeedback>('feedback_read', { p_business_id: id, p_sort: sort, p_offset: offset });
export const writeFeedback = (action: string, data: Record<string, unknown>) =>
  rpc<{ ok: boolean }>('feedback_write', { p_action: action, p_data: data });
export const loadAdminFeedback = (kind: FeedbackAdminKind) => rpc<FeedbackAdminRow[]>('feedback_admin_read', { p_kind: kind });
export async function attachFeedbackRatings<T extends { id: string; rating: number; reviewCount: number }>(items: T[]): Promise<T[]> {
  const real = items.filter(item => /^[0-9a-f-]{36}$/i.test(item.id));
  if (!real.length) return items;
  const stats = await rpc<Record<string, { rating: number; count: number }>>('feedback_ratings', { p_ids: real.map(item => item.id) });
  return items.map(item => stats[item.id] ? { ...item, rating: Number(stats[item.id].rating), reviewCount: Number(stats[item.id].count) } : item);
}
export async function uploadFeedbackEvidence(asset: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number }): Promise<string> {
  if ((asset.fileSize ?? 0) > 5 * 1024 * 1024) throw new Error('Kanıt fotoğrafı en fazla 5 MB olabilir.');
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || !data.user) throw new Error('Oturum bulunamadı.');
  const mime = asset.mimeType || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('JPG, PNG veya WebP fotoğraf seçin.');
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${data.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  let payload: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Fotoğraf okunamadı.');
    payload = await response.blob();
  } else {
    if (!asset.base64) throw new Error('Fotoğraf verisi okunamadı.');
    payload = decode(asset.base64);
  }
  if ((payload instanceof ArrayBuffer ? payload.byteLength : payload.size) > 5 * 1024 * 1024) throw new Error('Kanıt fotoğrafı en fazla 5 MB olabilir.');
  const { error: uploadError } = await getSupabaseClient().storage.from('feedback-evidence').upload(path, payload, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  return path;
}
export async function removeUnusedEvidence(path: string): Promise<void> {
  const { error } = await getSupabaseClient().storage.from('feedback-evidence').remove([path]);
  if (error) throw new Error(error.message);
}
export async function feedbackServer<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabaseClient().functions.invoke('feedback-api', { body: { action, ...params } });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const text = await error.context.text();
        try { message = JSON.parse(text).error || message; } catch { message = text || message; }
      } catch { /* retain transport error */ }
    }
    throw new Error(message);
  }
  return data as T;
}

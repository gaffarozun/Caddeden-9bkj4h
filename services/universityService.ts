import { getSupabaseClient } from '@/template';
import { adminApi } from '@/services/adminService';
import { withRequestTimeout } from '@/services/requestTimeoutService';

export type UniversityMessageStatus = 'pending' | 'approved' | 'rejected';
export type UniversityAdminFilter = UniversityMessageStatus | 'withdrawn';
export interface UniversityPublicMessage { id: string; text: string; published_at: string }
export interface UniversityMessage {
  id: string; text: string; user_id: string; status: UniversityMessageStatus; moderation_reason: string | null;
  created_at: string; decided_at: string | null; published_at: string | null;
  withdrawn_at: string | null; withdrawn_by: string | null;
}
export interface UniversityAdminMessage extends UniversityMessage {
  author: { username: string | null; email: string } | null;
}
export const universityMessageLimit = 160;
export const universityStatusLabels: Record<UniversityMessageStatus, string> = {
  pending: 'Onay bekliyor', approved: 'Yayında', rejected: 'Yayınlanmadı',
};
export function normalizeUniversityText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}
export async function fetchUniversityPublicMessages(): Promise<UniversityPublicMessage[]> {
  const { data, error } = await withRequestTimeout(getSupabaseClient().rpc('university_public_messages'), 'Cadde TV yazıları yüklenemedi.');
  if (error) throw new Error(error.message);
  return (data ?? []) as UniversityPublicMessage[];
}
export async function fetchOwnUniversityMessages(userId: string): Promise<UniversityMessage[]> {
  const { data, error } = await withRequestTimeout(getSupabaseClient().from('university_messages')
    .select('id,user_id,text,status,moderation_reason,created_at,published_at,decided_at,withdrawn_at,withdrawn_by')
    .eq('user_id', userId).order('created_at', { ascending: false }), 'Yazı istekleriniz yüklenemedi.');
  if (error) throw new Error(error.message);
  return (data ?? []) as UniversityMessage[];
}
export async function submitUniversityMessage(value: string): Promise<string> {
  const text = normalizeUniversityText(value);
  if (Array.from(text).length < 4 || Array.from(text).length > universityMessageLimit) throw new Error('Yazınız 4–160 karakter arasında olmalıdır.');
  // Do not time out a write and suggest retrying an ambiguous submission.
  const { data, error } = await getSupabaseClient().rpc('submit_university_message', { p_text: text });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string') throw new Error('Yazı isteği doğrulanamadı. İsteklerinizi yenileyin.');
  return data;
}
export async function fetchAdminUniversityMessages(status: UniversityAdminFilter): Promise<UniversityAdminMessage[]> {
  const { data, error } = await adminApi.listUniversityMessages(status);
  if (error) throw new Error(error);
  return (data?.messages ?? []) as UniversityAdminMessage[];
}
export async function withdrawUniversityMessage(id: string): Promise<string> {
  // Server derives the actor from the existing JWT; callers cannot pass another author/admin identity.
  const { data, error } = await getSupabaseClient().rpc('withdraw_university_message', { p_id: id });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string') throw new Error('Kaldırma sonucu doğrulanamadı. Yazı listenizi yenileyin.');
  return data;
}
export async function moderateUniversityMessage(item: UniversityMessage, status: 'approved' | 'rejected', reason: string): Promise<void> {
  const { error } = await adminApi.moderateUniversityMessage(item.id, status, item.status, reason.trim());
  if (error) throw new Error(error);
}

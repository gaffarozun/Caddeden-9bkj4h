import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { requireCustomer } from './accountAccessService';

export interface BusinessRatingState { rating: number; count: number; mine: number | null; canRate: boolean }
export function isHalfStarRating(value: number): boolean {
  return Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}
async function ratingRpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(name, params);
  if (error) throw new Error([error.message, error.code ? `(${error.code})` : ''].filter(Boolean).join(' '));
  return data as T;
}
export const loadExperienceFeature = () => ratingRpc<boolean>('experiences_enabled');
export const loadBusinessRating = (businessId: string) => ratingRpc<BusinessRatingState>('business_star_state', { p_business_id: businessId });
export async function ratingServer(action: string, params: Record<string, unknown>): Promise<void> {
  const { data, error } = await getSupabaseClient().functions.invoke('rating-api', { body: { action, ...params } });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const status = error.context.status;
        const text = await error.context.text();
        let detail = text;
        try { detail = JSON.parse(text).error ?? text; } catch { /* retain server response */ }
        message = `[${status}] ${detail || message}`;
      } catch { /* retain transport error */ }
    }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.error ?? 'İşlem doğrulanamadı.');
}
export const submitBusinessRating = async (businessId: string, rating: number) => {
  await requireCustomer();
  if (!isHalfStarRating(rating)) return Promise.reject(new Error('0,5–5 arasında yarım yıldız adımlarıyla puan seçin.'));
  return ratingServer('rate', { business_id: businessId, rating });
};
export const setExperienceFeature = (enabled: boolean) => ratingServer('set_experiences_enabled', { enabled });
export async function attachStarRatings<T extends { id: string; rating: number; reviewCount: number }>(items: T[]): Promise<T[]> {
  const ids = items.filter(item => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)).map(item => item.id);
  if (!ids.length) return items;
  const stats = await ratingRpc<Record<string, { rating: number; count: number }>>('business_star_stats', { p_ids: ids });
  return items.map(item => stats[item.id] ? { ...item, rating: Number(stats[item.id].rating), reviewCount: Number(stats[item.id].count) } : item);
}

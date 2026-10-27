import { getSupabaseClient } from '@/template';
import { requireCustomer } from './accountAccessService';
import { isHalfStarRating, ratingServer } from './ratingService';
import { withRequestTimeout } from './requestTimeoutService';

export interface OrderRatingPrompt {
  order_id: string;
  business_id: string;
  business_name: string;
  delivered_at: string;
  mine: number | null;
}

// An opening has a fixed cutoff. A delivery during that opening waits for the next opening.
export function orderWasDeliveredBeforeOpening(deliveredAt: string, openedBefore: string): boolean {
  const delivery = Date.parse(deliveredAt);
  const opening = Date.parse(openedBefore);
  return Number.isFinite(delivery) && Number.isFinite(opening) && delivery < opening;
}

export function visibleOrderRatingPrompts(items: OrderRatingPrompt[], openedBefore: string, postponed: ReadonlySet<string>): OrderRatingPrompt[] {
  return items.filter(item => !postponed.has(item.order_id) && orderWasDeliveredBeforeOpening(item.delivered_at, openedBefore));
}

export async function fetchOrderRatingPrompts(openedBefore: string): Promise<OrderRatingPrompt[]> {
  const { data, error } = await withRequestTimeout(
    getSupabaseClient().rpc('pending_order_ratings', { p_opened_before: openedBefore }),
    'Değerlendirme hatırlatmaları alınamadı.',
  );
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('Değerlendirme bilgisi doğrulanamadı.');
  return data.map(row => ({
    order_id: String(row.order_id), business_id: String(row.business_id),
    business_name: String(row.business_name), delivered_at: String(row.delivered_at),
    mine: row.mine == null ? null : Number(row.mine),
  }));
}

export async function submitOrderBusinessRating(orderId: string, rating: number, expectedUserId: string): Promise<void> {
  if (!isHalfStarRating(rating)) throw new Error('0,5–5 arasında yarım yıldız puanı seçin.');
  const userId = await requireCustomer();
  if (userId !== expectedUserId) throw new Error('Hesabınız değişti. Değerlendirmeyi yeniden açın.');
  // Business identity comes from the owned, delivered order on the server, never the request.
  await ratingServer('rate_order', { order_id: orderId, rating });
}

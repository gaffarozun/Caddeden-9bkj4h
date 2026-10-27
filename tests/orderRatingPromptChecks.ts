import { orderWasDeliveredBeforeOpening, OrderRatingPrompt, visibleOrderRatingPrompts } from '../services/orderRatingService';
import { isHalfStarRating } from '../services/ratingService';
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }

export function runOrderRatingPromptChecks() {
  const opening = '2026-10-23T12:00:00Z';
  assert(orderWasDeliveredBeforeOpening('2026-10-23T11:59:59Z', opening), 'A prior delivery is eligible on the next opening.');
  assert(!orderWasDeliveredBeforeOpening(opening, opening), 'A delivery exactly at opening is not a previous delivery.');
  assert(!orderWasDeliveredBeforeOpening('2026-10-23T12:00:01Z', opening), 'A delivery in the current opening must wait.');
  assert(!orderWasDeliveredBeforeOpening('invalid', opening), 'Invalid delivery timestamps must not produce prompts.');
  assert(!orderWasDeliveredBeforeOpening(opening, 'invalid'), 'Invalid opening timestamps must not produce prompts.');
  const prompts: OrderRatingPrompt[] = [
    { order_id: 'previous', business_id: 'business', business_name: 'Kafe', delivered_at: '2026-10-23T11:00:00Z', mine: null },
    { order_id: 'postponed', business_id: 'business-2', business_name: 'Lokanta', delivered_at: '2026-10-23T10:00:00Z', mine: 3.5 },
    { order_id: 'current', business_id: 'business-3', business_name: 'Restoran', delivered_at: '2026-10-23T13:00:00Z', mine: null },
  ];
  const snapshot = JSON.stringify(prompts);
  const deferred = new Set(['postponed']);
  assert(visibleOrderRatingPrompts(prompts, opening, deferred).map(item => item.order_id).join() === 'previous', 'Session postponement and opening cutoff must both apply.');
  assert(visibleOrderRatingPrompts(prompts, '2026-10-23T14:00:00Z', new Set()).length === 3, 'Postponed and new deliveries can appear at a later opening.');
  assert(JSON.stringify(prompts) === snapshot, 'Prompt filtering must never mutate data.');
  assert(isHalfStarRating(0.5) && isHalfStarRating(3.5) && isHalfStarRating(5), 'Independent half-star scoring must be preserved.');
  assert(!isHalfStarRating(0) && !isHalfStarRating(2.25) && !isHalfStarRating(5.5), 'Invalid or absent star selections must not be submitted.');
  return 'passed: next-opening cutoff, session postponement, immutable prompt filtering and half-star validation';
}

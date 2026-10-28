// Standalone pure checks: import runFeedOrderChecks() in a TypeScript test runner.
import { reconcileFeedOrder, shuffleFeed } from '../services/feedOrderService';
import { discoveryRatingSorts, sortDiscoveryBusinesses } from '../services/discoveryRatingService';
import { Business } from '../services/types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
export function runFeedOrderChecks(): string {
  const source = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }, { id: 'c', value: 3 }];
  const original = JSON.stringify(source);
  const shuffled = shuffleFeed(source, () => 0);
  assert(shuffled.map(item => item.id).join(',') !== 'a,b,c', 'Deterministic shuffle must rearrange input.');
  assert(JSON.stringify(source) === original, 'Shuffle must not mutate input.');
  assert(new Set(shuffled.map(item => item.id)).size === source.length, 'Shuffle must not lose or duplicate rows.');
  assert(shuffleFeed([], () => 0).length === 0, 'Empty feed must be safe.');
  assert(shuffleFeed([source[0]], () => 0).length === 1, 'Single row must be safe.');
  const unchanged = reconcileFeedOrder(shuffled, source, () => 0.5);
  assert(unchanged.map(item => item.id).join(',') === shuffled.map(item => item.id).join(','), 'Polling must retain random order.');
  const updated = reconcileFeedOrder(shuffled, [{ id: 'b', value: 20 }, { id: 'c', value: 30 }, { id: 'd', value: 40 }], () => 0.5);
  assert(!updated.some(item => item.id === 'a'), 'Removed/expired rows must disappear.');
  assert(updated.find(item => item.id === 'b')?.value === 20, 'Retained rows must use latest content.');
  assert(updated.some(item => item.id === 'd') && updated.length === 3, 'New rows must be inserted once.');
  assert(updated.filter(item => item.id !== 'd').map(item => item.id).join(',') === 'b,c', 'Survivors must retain relative order.');
  const deduped = reconcileFeedOrder([], [...source, source[0]], () => 0.5);
  assert(deduped.length === 3, 'Reconciliation must deduplicate IDs.');
  const business: Business = { id: '00000000-0000-4000-8000-000000000001', name: 'B', category: 'kafe', description: '', cover: '', images: [], rating: 3, reviewCount: 1, distanceKm: 0, address: '', phone: '', hours: '', isOpen: false, featured: false, hasMenu: true, menu: [], pin: { x: 0, y: 0 } };
  const higher: Business = { ...business, id: '00000000-0000-4000-8000-000000000002', name: 'A', rating: 5, isOpen: true };
  const recommendations = sortDiscoveryBusinesses([business, higher], 'recommended');
  assert(recommendations[0].id === business.id, 'Recommended must not prioritize open/name/rating order.');
  assert(sortDiscoveryBusinesses([business, higher], 'highest')[0].id === higher.id, 'Explicit highest-rating sort must remain.');
  assert(discoveryRatingSorts.length === 3, 'Discovery must offer recommended, highest-rating and nearest sorting options.');
  assert(discoveryRatingSorts.map(item => item.id).join(',') === 'recommended,highest,nearest', 'Recommended, highest-rating and nearest choices must remain.');
  return 'passed: random ordering, immutability, polling stability, updates, removal, deduplication and explicit rating sorts';
}

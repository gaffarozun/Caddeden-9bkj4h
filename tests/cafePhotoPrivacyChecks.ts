import { CafeVisit, isCafeVisitLive } from '../services/cafePresenceService';
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
export function runCafePhotoPrivacyChecks() {
  const now = Date.parse('2026-10-23T12:00:00Z');
  const hidden: CafeVisit = { business_id: 'cafe', business_name: 'Kafe', photo_visible: false, expires_at: '2026-10-23T12:05:00Z' };
  assert(isCafeVisitLive(hidden, now), 'Hidden participants still have a live visit.');
  assert(!isCafeVisitLive(hidden, now + 5 * 60000), 'Visits expire at the deadline, not after it.');
  assert(!isCafeVisitLive(null, now), 'No implicit cafe participation.');
  assert(!isCafeVisitLive({ ...hidden, expires_at: 'invalid' }, now), 'Invalid expiry fails closed.');
  assert(isCafeVisitLive({ ...hidden, photo_visible: true }, now), 'Both visibility choices support participation.');
  assert(hidden.photo_visible === false, 'Visit checks do not turn hidden photos visible.');
  return 'passed: explicit visibility model, finite lease, expiry and immutable checks';
}

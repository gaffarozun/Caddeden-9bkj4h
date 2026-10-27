import { CafeRoom, CafeVisit, isCafeRoomLocal, isVenueParticipationAvailable } from '../services/cafePresenceService';
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
export function runCafeVenuePageChecks() {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const visit: CafeVisit = { business_id: 'cafe-a', business_name: 'Kafe', photo_visible: false, expires_at: '2026-10-24T12:05:00Z', social_enabled: true };
  const room: CafeRoom = { enabled: true, mine: visit, count: 2, members: [], occupancy_enabled: true, participation_enabled: true, plan_visible: true };
  assert(isCafeRoomLocal(room, visit, 'cafe-a', now), 'A live server visit and matching live local visit unlock the venue.');
  assert(!isCafeRoomLocal(room, null, 'cafe-a', now), 'Local leave immediately hides the plan and peers.');
  assert(!isCafeRoomLocal({ ...room, mine: null }, visit, 'cafe-a', now), 'Local state alone does not prove location.');
  assert(!isCafeRoomLocal(room, visit, 'cafe-b', now), 'Another venue never unlocks.');
  assert(!isCafeRoomLocal(room, { ...visit, business_id: 'cafe-b' }, 'cafe-a', now), 'Cross-page stale visits never unlock.');
  assert(!isCafeRoomLocal(room, visit, 'cafe-a', now + 300000), 'Visit expires at the exact five-minute boundary.');
  assert(!isCafeRoomLocal({ ...room, mine: { ...visit, expires_at: 'invalid' } }, visit, 'cafe-a', now), 'Invalid server expiry is denied.');
  assert(isCafeRoomLocal({ ...room, enabled: false, members: [], mine: { ...visit, social_enabled: false } }, { ...visit, social_enabled: false }, 'cafe-a', now), 'Seating-only entry is independent of social participation.');
  assert(!isVenueParticipationAvailable(null), 'Loading never implies owner consent.');
  assert(!isVenueParticipationAvailable({ ...room, enabled: false, occupancy_enabled: false }), 'Opted-out businesses have no public venue entry.');
  assert(isVenueParticipationAvailable({ ...room, enabled: true, occupancy_enabled: false }), 'Social participation does not require seating or a cafe category.');
  assert(isVenueParticipationAvailable({ ...room, enabled: false, occupancy_enabled: true }), 'Owner-enabled seating remains independently available.');
  assert(isVenueParticipationAvailable(null, true), 'Managers can configure features before opting in.');
  return 'passed: server/local matching, expiry, leave, cross-venue privacy, seating-only entry and owner opt-in';
}

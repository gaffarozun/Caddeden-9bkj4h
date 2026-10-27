import { cafeOccupancyEstimate, cafeCapacity } from '../services/cafeSeatingService';
import { runCafeVenuePageChecks } from './cafeVenuePageChecks';
import { findCafeInstagramRequest, isCafeRequestBlocked, isInstagramHandleValid, normalizeInstagramHandle, CafeSocialRequest } from '../services/cafeSocialService';
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
export function runCafeSeatingSocialChecks() {
 assert(cafeOccupancyEstimate(4, 20) === 20, 'Occupancy uses participating customers and saved capacity.');
 assert(cafeOccupancyEstimate(0, 20) === 0, 'Zero participants means a zero estimate, not actual empty seats.');
 assert(cafeOccupancyEstimate(30, 20) === 100, 'Display is capped at 100 percent.');
 assert(cafeOccupancyEstimate(2, 0) === null, 'No capacity means no estimate.');
 assert(cafeOccupancyEstimate(NaN, 20) === null, 'Invalid counts fail safely.');
 assert(cafeCapacity([{ id: 't', label: 'Masa 1', seats: 4, grid_x: 0, grid_y: 0 }]) === 4, 'Plan seats define capacity.');
 assert(normalizeInstagramHandle(' @cadde_user ') === 'cadde_user', 'Only optional leading @ is removed.');
 assert(isInstagramHandleValid('cadde.user_1'), 'Valid handles are accepted.');
 assert(!isInstagramHandleValid('https://instagram.com/user'), 'Arbitrary URLs are not accepted.');
 assert(!isInstagramHandleValid('../private'), 'Path traversal is denied.');
 assert(!isInstagramHandleValid('a'.repeat(31)), 'Handle length is bounded.');
 assert(!isInstagramHandleValid(''), 'An absent Instagram handle must not allow sending or accepting.');
 const incomingAccepted: CafeSocialRequest = { id: 'mutual', user_id: 'peer', status: 'accepted', can_open: true, blocked_until: null };
 const pendingOutgoing: CafeSocialRequest = { id: 'pending', user_id: 'peer', status: 'pending', blocked_until: null };
 assert(findCafeInstagramRequest('peer', [incomingAccepted], [])?.id === 'mutual', 'The receiver can open the sender without creating a second request.');
 assert(findCafeInstagramRequest('peer', [], [incomingAccepted])?.id === 'mutual', 'The sender uses the same accepted request for counterpart access.');
 assert(findCafeInstagramRequest('peer', [incomingAccepted], [pendingOutgoing])?.id === 'mutual', 'Mutual accepted access takes precedence over a stale reverse pending request.');
 assert(findCafeInstagramRequest('other', [incomingAccepted], [pendingOutgoing]) === undefined, 'Consent for one peer is never reused for a different peer.');
 assert(findCafeInstagramRequest('peer', [], [pendingOutgoing])?.status === 'pending', 'Pending requests remain pending, not implicitly accepted.');
 assert(incomingAccepted.status === 'accepted' && pendingOutgoing.status === 'pending', 'Consent selection never mutates requests.');
 const now = Date.parse('2026-10-24T12:00:00Z');
 const request: CafeSocialRequest = { id: 'r', user_id: 'u', status: 'rejected', blocked_until: '2026-10-31T12:00:00Z' };
 assert(isCafeRequestBlocked(request, now), 'Rejection hides the recipient for seven days.');
 assert(!isCafeRequestBlocked(request, now + 7 * 86400000), 'Cooldown ends exactly at the boundary.');
 assert(!isCafeRequestBlocked(undefined, now), 'No implicit block.');
 assert(!isCafeRequestBlocked({ ...request, blocked_until: 'invalid' }, now), 'Invalid cooldown dates do not create permanent client-side blocks; server authorization remains authoritative.');
 assert(!isCafeRequestBlocked({ ...request, status: 'accepted', blocked_until: null }, now), 'Accepted requests with no cooldown are not hidden.');
 assert(cafeOccupancyEstimate(-2, 20) === 0, 'Negative estimates cannot render a negative progress bar.');
 assert(cafeOccupancyEstimate(2, Infinity) === null, 'Non-finite capacity cannot produce a misleading estimate.');
 assert(request.status === 'rejected', 'Privacy checks do not mutate request state.');
 runCafeVenuePageChecks();
 return 'passed: occupancy boundaries, required Instagram handles, mutual accepted-request selection, cooldown and location-gated venue page';
}

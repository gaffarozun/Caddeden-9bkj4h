import { cafeEntryRadiusMeters, cafePositionParameters, CafePosition, isCafePositionUsable, isCafeWithinEntryRadius } from '../services/cafeLocationRules';
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
export function runCafeArrivalChecks() {
 const now = Date.parse('2026-10-26T12:00:00Z');
 const position: CafePosition = { latitude: 41, longitude: 29, accuracy: 10, capturedAt: now };
 assert(cafeEntryRadiusMeters === 50, 'Entry uses 50 metres.');
 assert(isCafeWithinEntryRadius(0) && isCafeWithinEntryRadius(49.999), 'Distances below 50 m accepted.');
 assert(!isCafeWithinEntryRadius(50) && !isCafeWithinEntryRadius(100), 'Exact boundary and distant venues denied.');
 assert(!isCafeWithinEntryRadius(-1) && !isCafeWithinEntryRadius(NaN) && !isCafeWithinEntryRadius(Infinity), 'Invalid distances fail closed.');
 assert(isCafePositionUsable(position, now), 'Fresh fix accepted.');
 assert(isCafePositionUsable({ ...position, accuracy: 200 }, now), 'No 20 m accuracy ceiling.');
 assert(isCafePositionUsable({ ...position, accuracy: null }, now), 'Platform may omit accuracy.');
 assert(!isCafePositionUsable({ ...position, accuracy: -1 }, now), 'Negative accuracy rejected.');
 assert(!isCafePositionUsable({ ...position, accuracy: Infinity }, now), 'Nonfinite accuracy rejected.');
 assert(!isCafePositionUsable({ ...position, latitude: NaN }, now), 'Nonfinite coordinates rejected.');
 assert(!isCafePositionUsable({ ...position, longitude: 181 }, now), 'Invalid coordinates rejected.');
 assert(!isCafePositionUsable({ ...position, capturedAt: now - 60001 }, now), 'Stale fix rejected.');
 assert(!isCafePositionUsable({ ...position, capturedAt: now + 15001 }, now), 'Future fix rejected.');
 const body = cafePositionParameters(position);
 assert(body.p_accuracy === 10 && body.p_captured_at === '2026-10-26T12:00:00.000Z', 'Captured GPS is sent transiently.');
 return 'passed: 50 m boundary, uncapped accuracy, finite coordinates and freshness';
}

import { sortBusinessesByProximity } from '../services/discoveryLocationService';
import { sortNearbyCafes } from '../services/cafePresenceService';
import { venueRatioPairs } from '../services/venueDemographicsService';
import type { Business } from '../services/types';
export function runNearbyDiscoveryChecks() {
 const assert = (condition: boolean, label: string) => { if (!condition) throw new Error(label); };
 const near = { id: '00000000-0000-0000-0000-000000000001', lat: 41, lng: 29 } as Business;
 const far = { ...near, id: '00000000-0000-0000-0000-000000000002', lat: 42 };
 const missing = { ...near, id: '00000000-0000-0000-0000-000000000003', lat: undefined };
 const demo = { ...near, id: 'demo', distanceKm: 0.1 };
 const source = [far, missing, demo, near];
 const result = sortBusinessesByProximity(source, { latitude: 41, longitude: 29 });
 assert(result[0].id === near.id && result[1].id === far.id, 'Actual GPS determines order.');
 assert(result[0].distanceKm === 0 && result[0].distanceMeasured === true, 'Zero distance is measured, not missing.');
 assert(result[2].distanceMeasured === false && result[3].distanceMeasured === false, 'Missing/demo coordinates never imply proximity.');
 assert(source[0] === far, 'Sorting never mutates the feed.');
 const cafes = sortNearbyCafes([49, 12, 50, NaN, -1, 0].map((distance, index) => ({ business_id: String(index), business_name: String(index), social_enabled: true, distance_meters: distance })));
 assert(cafes.length === 3 && cafes[0].distance_meters === 0 && cafes[2].distance_meters === 49, 'Only in-radius candidates, nearest first.');
 const pairs = venueRatioPairs({ total: 10, female: 2, male: 3, gender_unknown: 5, student: 4, university: 3, nonstudent: 2, education_unknown: 4 });
 assert(pairs.length === 2 && pairs[0].first === 40 && pairs[0].second === 60, 'Gender is one independent declared-data partition.');
 assert(pairs[1].first === 50 && pairs[1].second === 50, 'University status is a separate partition; undisclosed education is not counted as non-student.');
 assert(venueRatioPairs()[0].first === null && venueRatioPairs()[1].second === null, 'No fabricated ratios in empty/undeclared groups.');
 return 'passed: proximity sorting, candidate boundary, zero/missing distance and separate demographic pairs';
}

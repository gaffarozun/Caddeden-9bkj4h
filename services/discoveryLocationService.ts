import { Business } from './types';
import { CafePosition } from './cafeLocationRules';
import { getGrantedCafePosition } from './cafePresenceService';
import { distanceMeters } from './geo';
export type DiscoveryPosition = Pick<CafePosition, 'latitude' | 'longitude'>;
export async function fetchDiscoveryPosition(requestPermission = true): Promise<DiscoveryPosition> {
 const position = await getGrantedCafePosition(requestPermission);
 if (!position) throw new Error('Yakınlık sıralaması için konum izni verin.');
 return { latitude: position.latitude, longitude: position.longitude };
}
export function discoveryDistanceMeters(business: Business, position: DiscoveryPosition): number | null {
 if (!/^[0-9a-f-]{36}$/i.test(business.id) || !Number.isFinite(business.lat) || !Number.isFinite(business.lng)
  || Math.abs(business.lat!) > 90 || Math.abs(business.lng!) > 180) return null;
 return distanceMeters(position.latitude, position.longitude, business.lat!, business.lng!);
}
export function sortBusinessesByProximity(items: Business[], position: DiscoveryPosition): Business[] {
 const ranked = items.map((business, index) => ({ business, index, distance: discoveryDistanceMeters(business, position) }));
 ranked.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.index - b.index);
 return ranked.map(({ business, distance }) => ({ ...business, distanceKm: distance === null ? 0 : distance / 1000, distanceMeasured: distance !== null }));
}

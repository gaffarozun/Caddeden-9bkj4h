import * as Location from 'expo-location';
import { isCafePositionUsable, CafePosition } from './cafeLocationRules';
import { withRequestTimeout } from './requestTimeoutService';
import { updateBusinessProfile } from './businessManageService';
// Owner-initiated capture uses the same finite-coordinate/freshness policy as confirmation.
export async function saveBusinessCurrentLocation(businessId: string): Promise<CafePosition> {
 const permission = await Location.requestForegroundPermissionsAsync();
 if (!permission.granted) throw new Error('İşletme konumunu kaydetmek için konum izni verin.');
 if (!await Location.hasServicesEnabledAsync()) throw new Error('Cihaz konumunu açın.');
 const fix = await withRequestTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), 'Konum alınamadı. İşletmenin içinde yeniden deneyin.', 20000);
 const position: CafePosition = { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy, capturedAt: fix.timestamp };
 if (!isCafePositionUsable(position)) throw new Error('Güncel konum alınamadı. İşletmede yeniden deneyin.');
 const { error } = await updateBusinessProfile(businessId, { lat: position.latitude, lng: position.longitude });
 if (error) throw new Error(error);
 return position;
}

import { getSupabaseClient } from '@/template';
import * as Location from 'expo-location';
import { withRequestTimeout } from './requestTimeoutService';
import { CafeTable } from './cafeSeatingService';
import { CafeRequestStatus } from './cafeSocialService';
import { CafePosition, cafePositionParameters, isCafePositionUsable, isCafeWithinEntryRadius } from './cafeLocationRules';

export interface CafeVisit { business_id: string; business_name: string; photo_visible: boolean; expires_at: string; social_enabled?: boolean }
export interface VenueDemographics { total: number; female: number; male: number; gender_unknown: number; student: number; university: number; nonstudent: number; education_unknown: number }
export interface CafeMember { education_status?: string | null; school_name?: string | null; user_id: string; name: string; photo_path: string | null; anonymous?: boolean; has_instagram?: boolean; request_status?: CafeRequestStatus | null; request_id?: string | null }
export interface CafeRoom { demographics?: VenueDemographics; enabled: boolean; mine: CafeVisit | null; count: number; members: CafeMember[]; occupancy_enabled?: boolean; tables?: CafeTable[]; capacity?: number; participation_enabled?: boolean; plan_visible?: boolean; occupancy_percent?: number | null; occupancy_visible?: boolean }
export const cafePollMilliseconds = 10000;
// All published geolocated venues support participation; public aggregates reveal no profiles.
export function isVenueParticipationAvailable(room: CafeRoom | null, manage = false): boolean {
  return manage || !!(room?.enabled || room?.occupancy_enabled);
}
export function isCafeVisitLive(visit: CafeVisit | null, now = Date.now()): visit is CafeVisit {
  return !!visit && Number.isFinite(Date.parse(visit.expires_at)) && Date.parse(visit.expires_at) > now;
}
export function isCafeRoomLocal(room: CafeRoom | null, visit: CafeVisit | null, businessId: string, now = Date.now()): boolean {
  return isCafeVisitLive(visit, now) && isCafeVisitLive(room?.mine ?? null, now)
    && visit.business_id === businessId && room?.mine?.business_id === businessId;
}
async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await withRequestTimeout(getSupabaseClient().rpc(name, body), 'Mekân bilgileri alınamadı. Bağlantınızı kontrol edin.');
  if (error) throw new Error(error.message);
  return data as T;
}
export const fetchMyCafeVisit = () => rpc<CafeVisit | null>('cafe_my_visit');
export const fetchCafeRoom = (businessId: string) => rpc<CafeRoom>('cafe_room_state', { p_business: businessId });
export const setCafeRoomEnabled = (businessId: string, enabled: boolean) => rpc<{ enabled: boolean }>('cafe_set_room', { p_business: businessId, p_enabled: enabled });
export const setCafePhotoVisibility = (visible: boolean) => rpc<CafeVisit>('cafe_set_visibility', { p_visible: visible });
export const leaveCafe = () => rpc<void>('cafe_leave');
export async function refreshCafeLocation(businessId: string): Promise<CafeVisit | null> {
 const position = await getGrantedCafePosition(false);
 if (!position) throw new Error('Mekân katılımı için konum izni gerekli.');
 return rpc<CafeVisit | null>('cafe_refresh_location', { p_business: businessId, ...cafePositionParameters(position) });
}
export interface NearbyCafe { business_id: string; business_name: string; social_enabled: boolean; distance_meters: number }
async function readCafePosition(): Promise<CafePosition> {
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Cihaz konumu kapalı. Konumu açıp yeniden deneyin.');
  const fix = await withRequestTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), 'Konum alınamadı. Mekânın içinde yeniden deneyin.', 20000);
  const position: CafePosition = { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy, capturedAt: fix.timestamp };
  if (!isCafePositionUsable(position)) throw new Error('Güncel konum alınamadı. Yeniden deneyin.');
  return position;
}
// Only an explicit control action can open the permission dialog. GPS is never persisted.
export async function getGrantedCafePosition(requestPermission = false): Promise<CafePosition | null> {
  const permission = requestPermission ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  return readCafePosition();
}
export async function fetchNearbyCafes(position: CafePosition): Promise<NearbyCafe[]> {
  if (!isCafePositionUsable(position)) return [];
  const rows = await rpc<NearbyCafe[]>('cafe_nearby', cafePositionParameters(position));
  return sortNearbyCafes(Array.isArray(rows) ? rows : []);
}
// Never trust transport order: both selection and automatic prompts use closest-first candidates.
export function sortNearbyCafes(rows: NearbyCafe[]): NearbyCafe[] {
  return rows.filter(row => isCafeWithinEntryRadius(row.distance_meters)).slice().sort((a, b) =>
    a.distance_meters - b.distance_meters || a.business_id.localeCompare(b.business_id));
}
export async function joinCafe(businessId: string, visible: boolean): Promise<CafeVisit> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Burada olduğunuzu doğrulamak için konum izni verin.');
  const position = await readCafePosition();
  return rpc<CafeVisit>('cafe_join', { p_business: businessId, ...cafePositionParameters(position), p_visible: visible });
}

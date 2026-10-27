// Shared 50-metre entry/exit policy. Fresh GPS fixes are transient; no accuracy ceiling.
export const cafeEntryRadiusMeters = 50;
export const cafeArrivalPollMilliseconds = 20000;
export interface CafePosition { latitude: number; longitude: number; accuracy: number | null; capturedAt: number }
export function isCafePositionUsable(position: CafePosition, now = Date.now()): boolean {
  return Number.isFinite(position.latitude) && position.latitude >= -90 && position.latitude <= 90
    && Number.isFinite(position.longitude) && position.longitude >= -180 && position.longitude <= 180
    && (position.accuracy === null || (Number.isFinite(position.accuracy) && position.accuracy >= 0))
    && Number.isFinite(position.capturedAt) && position.capturedAt >= now - 60000 && position.capturedAt <= now + 15000;
}
export function isCafeWithinEntryRadius(distance: number): boolean {
  return Number.isFinite(distance) && distance >= 0 && distance < cafeEntryRadiusMeters;
}
export function cafePositionParameters(position: CafePosition) {
  return { p_lat: position.latitude, p_lng: position.longitude, p_accuracy: position.accuracy, p_captured_at: new Date(position.capturedAt).toISOString() };
}

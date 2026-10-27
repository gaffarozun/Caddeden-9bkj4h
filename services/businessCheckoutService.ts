import * as Location from 'expo-location';
import { distanceMeters } from './geo';
import { placeOrder } from './businessRequestService';
export async function locateDelivery() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Konumunuzu paylaşmak için konum iznini açın.');
  const position = await Location.getCurrentPositionAsync({});
  let address = '';
  try { const rows = await Location.reverseGeocodeAsync(position.coords); const g = rows[0]; if (g) address = [g.street, g.name, g.district, g.city].filter(Boolean).join(' '); } catch { /* Address can be entered manually. */ }
  return { lat: position.coords.latitude, lng: position.coords.longitude, address };
}
export async function submitDeliveryOrder(params: Parameters<typeof placeOrder>[0]) {
  if (!params.phone.trim() || !params.address.trim()) throw new Error('Telefon ve teslimat adresi zorunludur.');
  if (params.lat == null || params.lng == null) throw new Error('Konumumu kullan düğmesiyle teslimat konumunu ekleyin.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Sipariş göndermek için konum izni zorunludur.');
  const position = await Location.getCurrentPositionAsync({});
  const distance = distanceMeters(position.coords.latitude, position.coords.longitude, params.lat, params.lng);
  if (distance > 1000) throw new Error(`Teslimat konumuna ${Math.round(distance)} m uzaktasınız. Konumu güncelleyin; en fazla 1 km uzakta olabilirsiniz.`);
  const result = await placeOrder(params); if (result.error) throw new Error(result.error);
}

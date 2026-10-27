import * as Crypto from 'expo-crypto';
import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from './requestTimeoutService';
export interface CafeTable { id: string; label: string; seats: number; grid_x: number; grid_y: number }
export const cafeGridColumns = 6;
export const cafeGridRows = 10;
export function cafeCapacity(tables: CafeTable[]): number { return tables.reduce((total, table) => total + Math.max(0, Number(table.seats) || 0), 0); }
export function cafeOccupancyEstimate(count: number, capacity: number): number | null {
 if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(count)) return null;
 return Math.min(100, Math.max(0, Math.round(count / capacity * 100)));
}
export function makeCafeTable(tables: CafeTable[]): CafeTable | null {
 for (let y = 0; y < cafeGridRows; y++) for (let x = 0; x < cafeGridColumns; x++) {
  if (!tables.some(table => table.grid_x === x && table.grid_y === y)) return { id: Crypto.randomUUID(), label: `Masa ${tables.length + 1}`, seats: 4, grid_x: x, grid_y: y };
 }
 return null;
}
export async function saveCafeSeating(businessId: string, enabled: boolean, tables: CafeTable[]): Promise<void> {
 if (enabled && tables.length === 0) throw new Error('Gösterimi açmak için önce en az bir masa ekleyin.');
 if (tables.some(table => !table.label.trim() || !Number.isInteger(table.seats) || table.seats < 1 || table.seats > 12)) throw new Error('Her masaya bir ad ve 1–12 kişilik kapasite girin.');
 // Text transport avoids gateway array-to-jsonb decoding failures; the database validates and atomically saves the plan.
 const { error } = await withRequestTimeout(getSupabaseClient().rpc('cafe_save_seating_payload', { p_business: businessId, p_enabled: enabled, p_plan: JSON.stringify(tables) }), 'Masa planı kaydedilemedi.');
 if (error) throw new Error(error.message);
}

import { Linking } from 'react-native';
import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from './requestTimeoutService';
export type CafeRequestStatus = 'pending' | 'accepted' | 'rejected';
export interface CafeSocialRequest { id: string; user_id: string; name?: string; status: CafeRequestStatus; photo_path?: string | null; can_accept?: boolean; can_open?: boolean; in_same_venue?: boolean; requester_sent_count?: number; blocked_until: string | null }
export interface CafeSocialData { incoming: CafeSocialRequest[]; outgoing: CafeSocialRequest[]; sent_recipient_count?: number }
export function normalizeInstagramHandle(value: string): string { return value.trim().replace(/^@/, ''); }
export function isInstagramHandleValid(value: string): boolean { return /^[A-Za-z0-9_][A-Za-z0-9_.]{0,29}$/.test(value); }
export function isCafeRequestBlocked(request: CafeSocialRequest | undefined, now = Date.now()): boolean { return !!request?.blocked_until && Date.parse(request.blocked_until) > now; }
// A single accepted request grants both participants access; never require a reverse request.
export function findCafeInstagramRequest(userId: string, incoming: CafeSocialRequest[], outgoing: CafeSocialRequest[]): CafeSocialRequest | undefined {
 const matches = [...outgoing, ...incoming].filter(item => item.user_id === userId);
 return matches.find(item => item.status === 'accepted' && item.can_open === true)
  ?? matches.find(item => item.status === 'accepted')
  ?? outgoing.find(item => item.user_id === userId)
  ?? incoming.find(item => item.user_id === userId);
}
async function socialRpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
 const { data, error } = await withRequestTimeout(getSupabaseClient().rpc(name, body), 'Mekân isteği tamamlanamadı. Bağlantınızı kontrol edin.');
 if (error) throw new Error(error.message); return data as T;
}
export const fetchCafeSocialState = () => socialRpc<CafeSocialData>('cafe_social_state');
export async function fetchOwnInstagram(userId: string): Promise<string> {
 const { data, error } = await withRequestTimeout(getSupabaseClient().from('cafe_social_profiles').select('instagram_handle').eq('user_id', userId).maybeSingle(), 'Instagram bilgisi alınamadı.');
 if (error) throw new Error(error.message); return data?.instagram_handle ?? '';
}
export async function saveCafeInstagram(value: string): Promise<string> {
 const handle = normalizeInstagramHandle(value);
 if (!isInstagramHandleValid(handle)) throw new Error('Bağlantı yerine Instagram kullanıcı adınızı girin; en fazla 30 karakter.');
 await socialRpc<void>('cafe_set_instagram', { p_handle: handle }); return handle;
}
export const requestCafeInstagram = (targetId: string) => socialRpc<{ id: string; status: CafeRequestStatus }>('cafe_request_instagram', { p_target: targetId });
export const decideCafeInstagram = (requestId: string, accept: boolean) => socialRpc<void>('cafe_decide_instagram', { p_request: requestId, p_accept: accept });
export const revokeCafeInstagram = (requestId: string) => socialRpc<void>('cafe_revoke_instagram', { p_request: requestId });
export async function openCafeInstagram(requestId: string): Promise<void> {
 // Retrieve the URL only on explicit press, after the server verifies current consent/co-presence.
 const url = await socialRpc<string>('cafe_instagram_link', { p_request: requestId });
 if (!/^https:\/\/www\.instagram\.com\/[A-Za-z0-9_][A-Za-z0-9_.]{0,29}\/$/.test(url)) throw new Error('Instagram bağlantısı doğrulanamadı.');
 await Linking.openURL(url);
}

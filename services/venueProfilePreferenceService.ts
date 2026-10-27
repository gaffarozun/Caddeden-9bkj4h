import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from './requestTimeoutService';
export async function fetchVenueProfilePreference(): Promise<boolean> {
 const { data, error } = await withRequestTimeout(getSupabaseClient().rpc('venue_profile_preference'), 'Profil gizliliği yüklenemedi.');
 if (error) throw new Error(error.message);
 return data === true;
}
export async function saveVenueProfilePreference(visible: boolean): Promise<void> {
 const { error } = await withRequestTimeout(getSupabaseClient().rpc('set_venue_profile_preference', { p_visible: visible }), 'Profil gizliliği kaydedilemedi.');
 if (error) throw new Error(error.message);
}

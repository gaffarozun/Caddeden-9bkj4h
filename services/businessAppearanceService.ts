import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import { requireBusinessAccess } from './accountAccessService';
import { listMenuItems, updateBusinessProfile } from './businessManageService';
import { isGoogleMapsUrl } from './businessProfileService';
export interface BusinessAppearance {
  mapsUrl: string; menuCover: string; groupCovers: Record<string, string>; tags: string[]; groups: string[];
}
export async function loadBusinessAppearance(id: string): Promise<BusinessAppearance> {
  await requireBusinessAccess(id);
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('businesses').select('maps_url,menu_cover_url,menu_group_covers,profile_tags').eq('id', id).single();
  if (error) throw new Error(error.message);
  const menu = await listMenuItems(id); if (menu.error) throw new Error(menu.error);
  return { mapsUrl: data.maps_url ?? '', menuCover: data.menu_cover_url ?? '', groupCovers: data.menu_group_covers ?? {}, tags: data.profile_tags ?? [], groups: Array.from(new Set(menu.data.map(item => item.group_name?.trim() || 'Menü'))) };
}
export async function saveBusinessAppearance(id: string, mapsUrl: string, tags: string) {
  if (mapsUrl.trim() && !isGoogleMapsUrl(mapsUrl)) throw new Error('https:// ile başlayan geçerli bir Google Haritalar bağlantısı girin.');
  const profileTags = tags.split(',').map(item => item.trim()).filter(Boolean).slice(0, 10);
  if (profileTags.some(tag => tag.length > 40)) throw new Error('Etiketler en fazla 40 karakter olabilir.');
  const result = await updateBusinessProfile(id, { maps_url: mapsUrl.trim() || null, profile_tags: profileTags });
  if (result.error) throw new Error(result.error);
}
export async function pickAppearanceImage(id: string): Promise<string | null> {
  await requireBusinessAccess(id);
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) throw new Error('Fotoğraf seçmek için galeri izni gerekli.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.9, base64: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri); const blob = await response.blob();
    const mime = blob.type || 'image/jpeg'; const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${id}/menu-covers/${Date.now()}.${extension}`; const sb = getSupabaseClient();
    const upload = await sb.storage.from('business-media').upload(path, blob, { contentType: mime });
    if (upload.error) throw new Error(upload.error.message);
    return sb.storage.from('business-media').getPublicUrl(path).data.publicUrl;
  }
  if (!asset.base64) throw new Error('Fotoğraf okunamadı. Başka bir fotoğraf deneyin.');
  const mime = asset.mimeType || 'image/jpeg';
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${id}/menu-covers/${Date.now()}.${extension}`; const sb = getSupabaseClient();
  const upload = await sb.storage.from('business-media').upload(path, decode(asset.base64), { contentType: mime, upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  return sb.storage.from('business-media').getPublicUrl(path).data.publicUrl;
}
export async function saveMenuCover(id: string, url: string | null, groupCovers?: Record<string, string>) {
  const result = await updateBusinessProfile(id, groupCovers ? { menu_group_covers: groupCovers } : { menu_cover_url: url });
  if (result.error) throw new Error(result.error);
}
export async function renameMenuGroup(id: string, oldName: string, newName: string) {
  await requireBusinessAccess(id);
  const name = newName.trim(); if (!name || name.length > 50) throw new Error('Kategori adı 1–50 karakter olmalıdır.');
  const sb = getSupabaseClient();
  const menu = await listMenuItems(id); if (menu.error) throw new Error(menu.error);
  const ids = menu.data.filter(item => (item.group_name?.trim() || 'Menü') === oldName).map(item => item.id);
  if (!ids.length) throw new Error('Bu kategoride ürün bulunamadı. Listeyi yenileyin.');
  const result = await sb.from('menu_items').update({ group_name: name }).eq('business_id', id).in('id', ids);
  if (result.error) throw new Error(result.error.message);
}

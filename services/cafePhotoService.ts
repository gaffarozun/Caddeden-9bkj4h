import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import { withRequestTimeout } from './requestTimeoutService';
const bucket = 'cafe-profile-photos';
export async function fetchMyCafePhotoPath(userId: string): Promise<string | null> {
  const { data, error } = await withRequestTimeout(getSupabaseClient().from('cafe_profile_photos').select('path').eq('user_id', userId).maybeSingle(), 'Profil fotoğrafı yüklenemedi.');
  if (error) throw new Error(error.message);
  return data?.path ?? null;
}
export async function downloadCafePhoto(path: string): Promise<string> {
  const { data, error } = await withRequestTimeout(getSupabaseClient().storage.from(bucket).download(path), 'Fotoğraf yüklenemedi.');
  if (error || !data) throw new Error(error?.message ?? 'Fotoğraf bulunamadı.');
  // Keep authorized photo bytes in memory only; never issue a reusable public/signed URL.
  return withRequestTimeout(new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Fotoğraf okunamadı.'));
    reader.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
    reader.readAsDataURL(data);
  }), 'Fotoğraf okunamadı.');
}
export async function pickAndUploadCafePhoto(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Fotoğraf seçmek için galeri izni verin.');
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  const size = Math.min(asset.width || 512, asset.height || 512);
  const processed = await ImageManipulator.manipulateAsync(asset.uri, [
    { crop: { originX: Math.max(0, ((asset.width || size) - size) / 2), originY: Math.max(0, ((asset.height || size) - size) / 2), width: size, height: size } },
    { resize: { width: 512 } },
  ], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!processed.base64) throw new Error('Fotoğraf hazırlanamadı.');
  const bytes = Platform.OS === 'web' ? await (await fetch(processed.uri)).blob() : decode(processed.base64);
  const length = bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.size;
  if (length > 1048576) throw new Error('Fotoğraf 1 MB sınırını aşıyor. Daha küçük bir fotoğraf seçin.');
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const client = getSupabaseClient();
  const { error: uploadError } = await withRequestTimeout(client.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', upsert: false }), 'Fotoğraf yüklenemedi.', 20000);
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await withRequestTimeout(client.rpc('cafe_save_photo', { p_path: path }), 'Fotoğraf kaydedilemedi.');
  if (error) throw new Error(error.message);
  return path;
}

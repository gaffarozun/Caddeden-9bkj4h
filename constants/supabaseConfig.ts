// Yalnızca istemci tarafı (publishable/anon) yapılandırması. service_role anahtarı ASLA istemcide kullanılmaz.
// Expo, EXPO_PUBLIC_* değişkenlerini derleme sırasında yalnızca bu şekilde (statik) yazılmış erişimlerde yerine koyar.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  /^https:\/\/[^\s<>]+$/.test(url) && anonKey.length > 20 && !anonKey.includes('<') && !url.includes('<');

// Supabase Auth hatalarını kullanıcıya anlaşılır Türkçe mesajlara çevirir.
// Ham hata yalnızca geliştirme sırasında (__DEV__) konsola yazılır; e-posta, parola, kod veya anahtar loglanmaz.
interface AuthLikeError { message?: string; code?: string; status?: number; name?: string }

export function describeAuthError(error: unknown, context: string): string {
  const e = (error ?? {}) as AuthLikeError;
  const raw = (e.message ?? (typeof error === 'string' ? error : '')).toString();
  const msg = raw.toLowerCase();
  const code = (e.code ?? '').toLowerCase();
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[auth:${context}]`, { code: e.code, status: e.status, name: e.name, message: raw });
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'E-posta veya şifre hatalı. Hesabınız yoksa önce kayıt olun.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'E-posta adresiniz henüz doğrulanmadı. Kayıt sırasında gelen kodla doğrulayın.';
  if (code === 'otp_expired' || msg.includes('expired')) return 'Doğrulama kodunun süresi dolmuş. Yeni kod isteyin.';
  if (code === 'otp_disabled' || msg.includes('signups not allowed') || code === 'signup_disabled') return 'Yeni kayıtlar şu anda kapalı. Lütfen daha sonra deneyin.';
  if (msg.includes('token has expired or is invalid') || msg.includes('invalid') && msg.includes('token')) return 'Doğrulama kodu hatalı ya da süresi dolmuş.';
  if (code === 'email_address_not_authorized' || msg.includes('email address not authorized')) return 'Bu e-posta adresine gönderim yapılamıyor: Supabase yerleşik e-posta servisi yalnızca proje ekibindeki adreslere gönderir. Yönetici özel SMTP tanımlamalı.';
  if (code === 'over_email_send_rate_limit' || msg.includes('email rate limit') || msg.includes('rate limit') || e.status === 429) return 'Kısa sürede çok fazla e-posta istendi. Birkaç dakika bekleyip tekrar deneyin.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seçin.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.';
  if (msg.includes('error sending') || code === 'unexpected_failure' && msg.includes('email')) return 'Doğrulama e-postası gönderilemedi. E-posta (SMTP) ayarları yapılandırılmamış olabilir; yöneticiye bildirin.';
  if (msg.includes('database error saving new user')) return 'Hesap oluşturulamadı (profil kaydı hatası). Veritabanı kurulumunun tamamlandığından emin olun.';
  if (e.status === 401 || msg.includes('invalid api key') || msg.includes('no api key')) return 'Yetkilendirme hatası: Supabase anon anahtarı (EXPO_PUBLIC_SUPABASE_ANON_KEY) geçersiz ya da başka bir projeye ait.';
  if (isNetworkError(error)) return 'Sunucuya istek gönderilemedi (ağ hatası).';
  if (msg.includes('hesap türü doğrulanamadı') || msg.includes('relation') && msg.includes('does not exist') || msg.includes('schema cache')) return 'Hesap bilgisi okunamadı. Veritabanı tabloları eksik olabilir (user_profiles); kurulum adımlarını tamamlayın.';
  return raw ? `İşlem tamamlanamadı: ${raw}` : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

export function isNetworkError(error: unknown): boolean {
  const e = (error ?? {}) as AuthLikeError;
  const msg = (e.message ?? (typeof error === 'string' ? error : '')).toString().toLowerCase();
  return e.name === 'AuthRetryableFetchError' || e.status === 0 || msg.includes('failed to fetch')
    || msg.includes('network request failed') || msg.includes('load failed') || msg.includes('networkerror');
}

export type ConnectionDiagnosis = 'offline' | 'host_unreachable' | 'reachable';

// Ağ hatasının gerçek nedenini ayırır: cihaz çevrimdışı mı, Supabase adresi mi ulaşılamıyor, yoksa sunucu mu yanıt veriyor.
// no-cors isteği yalnızca ağ/DNS düzeyinde başarısız olursa reddedilir; yanıt gövdesi okunmaz.
export async function diagnoseConnection(): Promise<ConnectionDiagnosis> {
  const nav = typeof navigator !== 'undefined' ? (navigator as { onLine?: boolean }) : undefined;
  if (nav && nav.onLine === false) return 'offline';
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return 'host_unreachable';
  const probe = async (url: string) => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 7000) : null;
    try { await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl?.signal }); return true; }
    catch { return false; } finally { if (timer) clearTimeout(timer); }
  };
  if (await probe(`${base}/auth/v1/health`)) return 'reachable';
  // Supabase ulaşılamıyor: genel internet var mı?
  if (await probe('https://www.gstatic.com/generate_204')) return 'host_unreachable';
  return 'offline';
}

export function messageForDiagnosis(d: ConnectionDiagnosis): string {
  if (d === 'offline') return 'Cihazınız internete bağlı görünmüyor. Bağlantınızı kontrol edip tekrar deneyin.';
  if (d === 'host_unreachable') return 'İnternetiniz çalışıyor ama Supabase sunucusuna ulaşılamıyor. Proje adresi (EXPO_PUBLIC_SUPABASE_URL) hatalı olabilir ya da Supabase projesi duraklatılmış/silinmiş. Uygulama yapılandırmasını kontrol edin.';
  return 'Sunucu yanıt veriyor ama istek tamamlanamadı (tarayıcı/ağ engeli olabilir). Sayfayı yenileyip tekrar deneyin.';
}

// Ağ hatasıysa teşhis ederek, değilse doğrudan eşleyerek mesaj döndürür.
export async function authMessage(error: unknown, context: string): Promise<string> {
  if (isNetworkError(error)) {
    const d = await diagnoseConnection();
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[auth:${context}] diagnosis`, d);
    return messageForDiagnosis(d);
  }
  return describeAuthError(error, context);
}

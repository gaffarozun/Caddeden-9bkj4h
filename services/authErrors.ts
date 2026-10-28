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
  if (code === 'over_email_send_rate_limit' || msg.includes('email rate limit') || msg.includes('rate limit') || e.status === 429) return 'Kısa sürede çok fazla e-posta istendi. Birkaç dakika bekleyip tekrar deneyin.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seçin.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.';
  if (msg.includes('error sending') || code === 'unexpected_failure' && msg.includes('email')) return 'Doğrulama e-postası gönderilemedi. E-posta (SMTP) ayarları yapılandırılmamış olabilir; yöneticiye bildirin.';
  if (msg.includes('database error saving new user')) return 'Hesap oluşturulamadı (profil kaydı hatası). Veritabanı kurulumunun tamamlandığından emin olun.';
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  if (msg.includes('hesap türü doğrulanamadı') || msg.includes('relation') && msg.includes('does not exist') || msg.includes('schema cache')) return 'Hesap bilgisi okunamadı. Veritabanı tabloları eksik olabilir (user_profiles); kurulum adımlarını tamamlayın.';
  return raw ? `İşlem tamamlanamadı: ${raw}` : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

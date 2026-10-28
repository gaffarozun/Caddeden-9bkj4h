# Kayıt, giriş ve yönetici paneli: Supabase tarafında yapılacaklar

Uygulama kodu bu adımların yapıldığını varsayar. Panel ayarları kodla değiştirilemez; Supabase Dashboard'da sizin yapmanız gerekir.
Buradaki hiçbir adımı gerçek projede ben çalıştırmadım.

## 1) Kayıt akışı nasıl çalışır
E-posta + şifre + **e-posta kodu (OTP)**: `signInWithOtp` kod gönderir → `verifyOtp` doğrular → `updateUser` şifreyi koyar → `user_profiles` güncellenir.
Profil satırını `auth.users` tetikleyicisi `handle_new_user` açar (baseline migration). Giriş: `signInWithPassword`.

## 2) Authentication ayarları (Dashboard)
1. **Authentication → Providers → Email**: açık. **Confirm email**: AÇIK kalmalı (yönetici güvenliği buna dayanır).
2. **Authentication → Emails → Templates → "Magic Link"** (OTP bu şablonla gider) gövdesinde `{{ .Token }}` bulunmalı, örn.: `Doğrulama kodunuz: {{ .Token }}`.
   Yalnızca `{{ .ConfirmationURL }}` varsa kullanıcıya kod değil bağlantı gider ve uygulamadaki kod ekranı çalışmaz. **"Confirm signup"** şablonuna da aynı şekilde `{{ .Token }}` ekleyin.
3. **Authentication → Rate limits / SMTP**: Supabase'in yerleşik e-posta servisi saatte çok az e-posta gönderir ve sadece takım üyelerine gider.
   Gerçek kullanıcılar için **Project Settings → Authentication → SMTP Settings** altında kendi SMTP sağlayıcınızı tanımlayın. Aksi halde "Kod gönderilemedi / çok fazla e-posta" hatası alırsınız.
4. **Authentication → URL Configuration**: Site URL = web adresiniz (`https://gaffarozun.github.io/Caddeden-9bkj4h/`); Redirect URLs listesine aynı adresi ve `onspaceapp://` şemasını ekleyin (şifre sıfırlama).
5. OTP uzunluğu (Authentication → Providers → Email) 6'dan farklıysa derlemeye `EXPO_PUBLIC_RECOVERY_OTP_LENGTH` verin (4-10).

## 3) Veritabanı (SQL Editor, sırayla; `supabase/apply_order.txt`)
`user_profiles` tablosu ve tetikleyiciler yoksa kayıt "Database error saving new user" ile düşer; uygulama bunu "profil kaydı hatası" olarak gösterir.
Sırayı ve dosya adlarını `BASELINE_SETUP.md` anlatır. Daha önce uygulanmış dosyaları körlemesine tekrar çalıştırmayın. Son durumu doğrulamak için `verify/readiness_check.sql` (yalnızca okur).

## 4) Yönetici hesabı (güvenli ilk kurulum)
- Yönetici yetkisi **veritabanında** tutulur: `user_profiles.role = 'admin'`. Bu rol yalnızca **doğrulanmış `caddeden.app@gmail.com`** hesabına verilebilir (`protect_admin_role` tetikleyicisi + tek yönetici dizini). Herkese açık yönetici kaydı yoktur; istemci hiçbir e-posta karşılaştırması yapmaz.
- Kurulum: uygulamada **`caddeden.app@gmail.com`** ile (normal kullanıcı kaydı) kayıt olun ve e-posta kodunu girin → profil otomatik `admin` olur.
  Başka bir yönetici e-postası kullanacaksanız bana bildirin: `protect_admin_role`, `handle_new_user`, `feedback_admin_allowed`, `account_admin` ve Edge Function'lar birlikte güncellenmeli (yeni migration hazırlanır).
- Giriş yaptıktan sonra **Profil** sayfasında "Yönetici Girişi" satırı görünür (kullanıcı ve işletme profilinde).
- Yönetici işlemlerinin çoğu `admin-api` Edge Function'ını çağırır; bu fonksiyon çağıranın rolünü sunucuda tekrar doğrular. Panelin verileri için fonksiyonları dağıtın:
  `supabase functions deploy admin-api feedback-api rating-api media-maintenance` (gerekli service role, Supabase tarafından fonksiyona otomatik verilir; asla uygulamaya konmaz).

## 5) Hata ayıklama
Geliştirme modunda (`pnpm web`/`expo start`) tarayıcı konsolunda `[auth:...]` satırı ham hata kodunu/durumunu gösterir (e-posta, şifre ve kod yazılmaz). Üretim derlemesinde yalnızca anlaşılır mesaj görünür.

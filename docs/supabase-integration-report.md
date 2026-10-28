# Supabase entegrasyonu · denetim raporu

Tarih: 2026-10-27 · Dal: `claude/supabase-integration` · Kaynak: GitHub `main` (180 dosya) + yüklenen proje zip'i (435 dosya)

## Özet

- Uygulama **zaten Supabase istemcisiyle** çalışıyor (Auth `signInWithOtp/verifyOtp/signInWithPassword`, `.from()` / `.rpc()`,
  Storage, Edge Functions). Koddaki tek OnSpace bağımlılığı `.env` içindeki proje URL'si ve anon anahtarıdır
  (`https://<ref>.backend.onspace.ai`, JWT `iss: onspace`). Başka OnSpace servis adresi/SDK çağrısı bulunmadı.
- Tasarım, ekranlar, renkler, gezinme ve özellik kodu **değiştirilmedi**.
- Asıl iş: `caddeden` Supabase projesine, mevcut arka ucun şemasını **birebir** taşımak. Temel şema depoda olmadığı için
  tahmin edilmedi; canlı şemayı çıkaran ve hedefi denetleyen SQL betikleri eklendi (aşağıda "Test durumu").

## Değişen / eklenen dosyalar

Mevcut `main` içindeki dosyalardan yalnızca **bir tanesi** değiştirildi, bir tanesi izlemeden çıkarıldı:

| Dosya | Değişiklik |
|---|---|
| `constants/passwordRecovery.ts` | Yorum Supabase'e güncellendi; e-posta kodu uzunluğu sabit 4 yerine `EXPO_PUBLIC_RECOVERY_OTP_LENGTH` (4–10, varsayılan 6). Supabase varsayılanı 6'dır, 4 haneli kod üretmez. |
| `.env` | Git izlemesinden çıkarıldı (`git rm --cached`); yerel dosya duruyor. `main` geçmişinde eski değer kalır (içeriği yalnızca URL + anon anahtarı, gizli anahtar değil). |

Eklenenler (hepsi yeni dosya):

- `.env.example`, `.gitignore` (`.env` ve `.env.*` yok sayılır, `.env.example` hariç)
- `supabase/README.md` (kurulum/geçiş rehberi), `supabase/export/export_live_schema.sql`, `supabase/verify/readiness_check.sql`
- `README.md`, bu rapor
- `main`'de eksik olan uygulama dosyaları, yüklenen zip'ten **aynen** eklendi (üzerine yazılan dosya yok):
  `package.json`, `app/(tabs)`, `app/(business-tabs)`, `app/admin/*`, `app/business/*`, `hooks/`, `services/`, `contexts/`,
  `tests/`, `scripts/` vb. (255 dosya; bunlardan 5'i aşağıda belirtilen şekilde uyarlandı: `.gitignore`, `README.md`, `tests/passwordRecoveryChecks.ts`, `components/feature/PasswordRecoveryView.tsx`, `docs/password-recovery-and-manual-feeds.md`). Bunlar olmadan depo `expo start` ile açılamıyordu (`package.json` yoktu).
- Uyarlamalar: `tests/passwordRecoveryChecks.ts` (OTP uzunluğu testi yapılandırmaya bağlandı),
  `components/feature/PasswordRecoveryView.tsx` (kod alanı yer tutucusu uzunluğa göre), `docs/password-recovery-and-manual-feeds.md` (metin).

## Güncelleme: temel şema eklendi

`supabase/migrations/20261001_baseline_inferred_schema.sql` koddan çıkarılan temel şemayı içerir (tablolar, tetikleyiciler, feedback RPC'leri, RLS, bucket'lar).
Uygulama sırası ve dashboard adımları: `supabase/BASELINE_SETUP.md`. Yerelde baseline + 27 migration hatasız uygulandı (smoke 186/186; yalnızca baseline 26/26). Güvenlik sertleştirmeleri: `supabase/BASELINE_SETUP.md` bölüm 2b.
Hedef Supabase projesinde **hiçbir SQL çalıştırılmadı**. Aşağıdaki 1. madde (temel şema yok) artık "kaynak şema doğrulanamadı" olarak okunmalıdır.

## Engelleyici / açık maddeler (çalışıyormuş gibi gösterilmedi)

1. **Temel şema depoda yok.** `supabase/migrations/` yalnızca sonradan eklenen 27 dosyadır; `businesses`, `orders`,
   `user_profiles` gibi tablolar, `feedback_write/read` fonksiyonları, `auth.users` tetikleyicisi ve ilk RLS/bucket
   politikaları yoktur. `20261020_feedback_criteria.sql` mevcut `feedback_write` gövdesini metin değiştirerek yamalar;
   o fonksiyon yoksa hata verir. → `supabase/export/export_live_schema.sql` ile kaynaktan çıkarılmalı.
2. **Eksik görsel:** `components/feature/CaddedenIntro.tsx`, `assets/images/caddeden-intro-night-street.webp` dosyasını
   `require` ediyor; dosya ne GitHub'da ne zip'te var (yalnızca OnSpace bulutunda kayıtlı, `.onspace/assets.json`).
   Dosya olmadan Metro paketi derlenmez. OnSpace projesinden dışa aktarıp `assets/images/` altına koyun. Placeholder
   üretilmedi (tasarımı değiştirir).
3. **Veri ve dosya taşıma** (kullanıcılar, işletmeler, görseller) kaynak veritabanına/storage'a erişim gerektirir; burada yapılamadı.
4. **E-posta şablonları:** kayıt akışı `signInWithOtp` ile e-posta **kodu** bekler; Supabase varsayılan şablonları
   yalnızca bağlantı içerir. `{{ .Token }}` eklenmeli (bkz. `supabase/README.md`, adım 6).
5. **Edge Function'lar** (`admin-api`, `feedback-api`, `rating-api`, `media-maintenance`) hedefte dağıtılmalı.
6. **Yönetici e-postası** SQL içinde sabit: `caddeden.app@gmail.com` (doğrulanmış e-posta ile admin rolü verilir).
7. **Gerçek zamanlı:** kodda Realtime aboneliği yok (polling). Bu davranış korundu.
8. **Ödeme:** `payments` tablosuna yönetici onayında `method: 'manual'` kaydı yazılıyor. Yönetici ekranlarında da
   belirtildiği gibi gerçek ödeme entegrasyonu (Stripe) kurulu değil; `@stripe/stripe-react-native` bağımlılığı kullanılmıyor.
9. **Ayrı web paneli yok.** `app.json` Expo web çıktısını açıyor; yönetici/işletme panelleri uygulama içindedir.
10. Derin bağlantı şeması `onspaceapp://` (ve `app.json` slug `onspace-app`) olduğu gibi bırakıldı; yeniden adlandırmak
    mevcut bağlantıları ve Auth yönlendirme listesini etkiler, ayrı bir karar.
11. Zip'teki genel README sürüm numaralarını yanlış yazıyordu (RN 0.79.4, Expo Router 5.1); `package.json` doğrudur (Expo ~53.0.9, RN 0.79.3, React 19.0.0). README yenilendi.

## Test durumu (dürüst)

| Ne | Durum |
|---|---|
| `export_live_schema.sql` | Yerel PostgreSQL 16'da, Supabase benzeri `auth`/`storage` iskeleti ve yapay nesnelerle (enum, identity, üretilmiş sütun, kısıt, indeks, görünüm, `auth.users` tetikleyicisi, RLS/force, kısıtlayıcı politika, `storage.objects` politikası, sütun yetkisi, bucket, yayın) çalıştırıldı; çıktı boş veritabanına uygulandı ve iki şemanın `pg_dump` çıktıları (yetki satır sırası hariç) **aynı** çıktı. Gerçek OnSpace/Supabase veritabanında **çalıştırılmadı**. |
| `readiness_check.sql` | Boş, kısmi ve bilerek bozulmuş (herkese açık `app_config`, koşulsuz UPDATE politikası) yerel veritabanlarında hatasız çalıştı ve beklenen FAIL/WARN satırlarını üretti; `app_config` değerlerini yazdırmadığı doğrulandı. Gerçek projede çalıştırılmadı. |
| Mevcut 27 migration | **Çalıştırılmadı** (temel şema olmadan çalışamaz, bkz. madde 1). |
| `supabase/tests/*.sql` | **Çalıştırılmadı.** |
| Uygulama derleme / `tsc` / `expo lint` / `tests/*.ts` | **Çalıştırılmadı:** bu ortamda npm kayıt defterine erişim yok, bağımlılıklar kurulamadı. `constants/passwordRecovery.ts` değişikliği küçük ve yalnızca sabit hesaplıyor, ama derlenmeden doğrulanmadı. |
| Kayıt, giriş, sipariş, görsel yükleme, işletme yönetimi akışları | **Cihazda/gerçek projede denenmedi.** Elle test listesi `supabase/README.md` içinde. |
| RLS / yetki incelemesi | Yalnızca depodaki migration SQL'i okunarak ve `readiness_check.sql` ile; gerçek politikalar kaynakta bulunduğu için **canlı politikalar incelenemedi**. |

## Güvenlik notları

- Kaynak kodda sabit gizli anahtar bulunmadı (`service_role`, `sk_*`, parola vb. taraması temiz). Edge Function'lar
  anahtarları `Deno.env` üzerinden okuyor.
- Depodaki `.env` yalnızca URL + **anon** JWT içeriyordu (gizli değil ama OnSpace projesine ait); izlemeden çıkarıldı.
  Yeni proje için kendi URL/anahtarınızı kullanın.
- `app_config` tablosu `admin_bootstrap_code` tutabiliyor; herkese açık okuma politikası olmamalı (`readiness_check.sql` bunu kontrol eder).

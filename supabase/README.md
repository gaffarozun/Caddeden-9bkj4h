# Caddeden · Supabase kurulum ve geçiş rehberi

> **GÜNCEL (boş proje):** Boş `caddeden` projesi için önerilen yol artık [`BASELINE_SETUP.md`](BASELINE_SETUP.md): önce
> `migrations/20261001_baseline_inferred_schema.sql`, sonra 27 migration `apply_order.txt` sırasıyla. Aşağıdaki
> `export_live_schema.sql` akışı yalnızca **dolu bir kaynak veritabanından** şema çıkarmak içindir; boş hedefte kullanılmaz.
> Hiçbir SQL hedef projede çalıştırılmış değildir.


Bu uygulama zaten Supabase istemcisiyle (`@supabase/supabase-js`) yazılmıştır. "OnSpace Cloud", arka planda
Supabase uyumlu bir arka uçtur ve koddaki **tek** bağımlılık `.env` içindeki proje URL'si ile anon anahtarıdır
(başka bir OnSpace servis adresi veya SDK çağrısı yoktur). Bu yüzden geçiş, kodu yeniden yazmak değil,
**`caddeden` Supabase projesini mevcut arka uçla aynı hale getirmektir.**

## Neden "sadece migration'ları çalıştır" yetmez?

`supabase/migrations/` altındaki 27 dosya yalnızca **sonradan eklenen** değişikliklerdir. Şunlar depoda **yoktur**:

- Temel tablolar: `user_profiles`, `businesses`, `menu_items`, `business_posts`, `orders`, `reservations`, `ads`,
  `ad_packages`, `campaigns`, `payments`, `notifications`, `notification_requests`, `complaints`,
  `account_deletion_requests`, `admin_logs`, `admin_alerts`, `app_config`, `business_reviews`
- `feedback_read`, `feedback_write`, `feedback_actor`, `feedback_admin_allowed` fonksiyonları
  (`20261020_feedback_criteria.sql` bunların gövdesini metin değiştirerek yamalar; yoksa migration hata verir)
- `auth.users` üzerindeki yeni kullanıcı tetikleyicisi (`handle_new_user`), ilk RLS politikaları ve
  `business-media` / `feedback-evidence` bucket'ları ve politikaları

Bunları koddan tahmin ederek yazmak, çalışıyormuş gibi görünen ama yanlış bir veritabanı üretirdi. Bu yüzden
canlı veritabanından **birebir** çıkaran bir betik hazırlandı (`export/export_live_schema.sql`).

## Adımlar

### 0) Ön koşul
- Supabase panelinde `caddeden` projesi var (yeni proje açmayın).
- Kaynak arka uca (OnSpace Cloud) **salt okunur** erişiminiz var: ya doğrudan veritabanı bağlantı dizesi,
  ya da panelindeki SQL editörü. İkisi de yoksa bu adım yapılamaz, OnSpace desteğinden/panelinden
  şema dökümü isteyin; şemayı tahmin etmeyin.

### 1) Kaynak şemayı çıkarın
```bash
# A) Bağlantı dizesi varsa (tercih edilen)
psql "$KAYNAK_DB_URL" -X -q -A -t -f supabase/export/export_live_schema.sql -o live_schema.sql

# B) Yalnızca SQL editörü varsa: önce `set search_path = pg_catalog;` çalıştırın, sonra dosyadaki
#    SELECT'i çalıştırın, tek hücrelik "script" çıktısını live_schema.sql olarak kaydedin.
```
Betik yalnızca `SELECT` yapar; veri, parola, `app_config` değeri veya anahtar yazdırmaz. Çıktıyı **uygulamadan önce
okuyun**. Dosya: tablolar → fonksiyonlar → kısıtlar → indeksler → tetikleyiciler (`auth.users` dahil) → RLS →
politikalar (`storage.objects` dahil) → yetkiler → bucket tanımları → satır sayıları (yorum).

### 2) Hedefe şemayı uygulayın
`caddeden` projesi **boşsa**:
```bash
psql "$HEDEF_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f live_schema.sql
```
Proje boş değilse önce hangi tabloların dolu olduğunu kontrol edin; betik `if not exists` / `drop policy if exists`
kullanır ama dolu bir şemanın üstüne körlemesine uygulamayın.

> Kaynakta zaten uygulanmış olan `supabase/migrations/*.sql` dosyalarını **tekrar uygulamayın**; `live_schema.sql`
> onların sonucunu içerir. Bir sonraki adımdaki kontrol bir migration'ın sonucunu eksik bulursa o dosyayı tek tek
> uygulayın.

### 3) Hazırlık kontrolü
Supabase SQL Editor'da `supabase/verify/readiness_check.sql` çalıştırın. Çıktıda **FAIL** satırı kalmamalı:
eksik tablo/fonksiyon, RLS kapalı tablo, eksik bucket/politika, eksik `auth.users` tetikleyicisi ve
herkese açık `app_config` okuması burada yakalanır.

### 4) Veri taşıma (isteğe bağlı: mevcut kullanıcı/işletme verisi varsa)
Resmi yöntem: [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
```bash
supabase db dump --db-url "$KAYNAK_DB_URL" -f data.sql --use-copy --data-only
psql --single-transaction -v ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' --file data.sql --dbname "$HEDEF_DB_URL"
```
- Bu, `auth.users` (parola özetleriyle) ve `user_profiles` kimliklerini birlikte taşır; kimlikler eşleşmek zorundadır.
- Veritabanı dökümü **dosyaları içermez**: `business-media`, `feedback-evidence`, `cafe-profile-photos` içindeki
  görselleri ayrıca taşıyın (yukarıdaki resmi rehberdeki storage betiği). Veritabanında kayıtlı `image_url`
  alanları eski proje adresini gösterir; taşımadan sonra yeni `https://<ref>.supabase.co/storage/v1/object/public/...`
  adresine güncelleyin (bu sorguyu verinize bakmadan yazmadım).
- `app_config.admin_bootstrap_code` değeri çıktıya yazılmaz. Hedefte elle oluşturun:
  `insert into public.app_config(key,value) values ('admin_bootstrap_code','<güçlü-rastgele-değer>') on conflict (key) do update set value = excluded.value;`

### 5) Edge Function'ları dağıtın
```bash
supabase link --project-ref <proje-ref>
supabase functions deploy admin-api feedback-api rating-api media-maintenance
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase tarafından otomatik sağlanır; başka
gizli değer gerekmez. **service_role anahtarını `.env`'e veya istemci koduna yazmayın.**

### 6) Authentication ayarları (panel)
- **Providers → Email**: açık; *Confirm email* açık (hesap etkinliği `email_confirmed_at` ister).
- **Email Templates**: kayıt, `signInWithOtp` ile **e-posta kodu** gönderir. *Confirm signup* ve *Magic Link*
  şablonlarına `{{ .Token }}` ekleyin; yoksa kullanıcıya kod gitmez ve kayıt tamamlanamaz.
  Şifre sıfırlamada kod göstermek istiyorsanız *Reset Password* şablonuna da ekleyin.
- **Email OTP Length**: varsayılan 6. Uygulamadaki sıfırlama alanı bu uzunluğa uyar
  (`EXPO_PUBLIC_RECOVERY_OTP_LENGTH`, varsayılan 6).
- **URL Configuration → Redirect URLs**: `onspaceapp://password-reset` (+ web kullanıyorsanız site adresiniz).
- **SMTP**: Supabase'in yerleşik e-posta servisi üretim için sınırlıdır; gerçek kullanıcılar için özel SMTP tanımlayın.
- **Yönetici hesabı**: SQL fonksiyonları yönetici rolünü yalnızca `caddeden.app@gmail.com` e-postasına, e-posta
  doğrulandıktan sonra verir. Bu adres değişecekse ilgili fonksiyonlar (`account_admin`, `handle_new_user`, ...) değişmelidir.

### 7) İstemci ayarı
```bash
cp .env.example .env     # EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY değerlerini caddeden projesinden girin
```
Yalnızca URL ve publishable/anon anahtar kullanılır. `.env` artık `.gitignore`'dadır.

## Test

Otomatik uçtan uca test **yoktur** (cihaz/Expo gerektirir). Önerilen sıra:

1. `readiness_check.sql` → FAIL yok.
2. `supabase/tests/*_read_only.sql` dosyalarını SQL Editor'da çalıştırın (salt okunur şema/politika kontrolleri;
   bu depoda sizin hedef veritabanınızda çalıştırılmadı).
3. Uygulama: `pnpm install && pnpm expo start`
   - Kullanıcı kaydı (e-posta kodu) → giriş; İşletme kaydı → *kullanıcı girişiyle işletme girişinin reddedildiğini* doğrulayın.
   - Yönetici girişiyle işletme onayı → işletme yayına çıkar; menü ürünü ekleyin, görsel yükleyin (`business-media`).
   - Müşteri: sipariş ve rezervasyon verin; işletme panelinde durumları değiştirin; sipariş mesajı/puanlama.
   - Değerlendirme, kayıtlı işletmeler, kampanya/reklam başvurusu ve yönetici onayı, bildirim talebi.
   - İki farklı işletme hesabıyla birbirinin verisine erişilemediğini deneyin (ör. diğer işletmenin siparişleri listelenmemeli).
4. Şifre sıfırlama: bağlantı ve (şablonda varsa) kod yolu.

## Gerçek zamanlı güncellemeler

Kodda Supabase Realtime aboneliği **yoktur**; bildirim/akış güncellemeleri `useFocusEffect` ve zamanlayıcı ile
yoklanır (ör. `useCaddeTv`, `useCafePhoto`). Bu çalışır durumda bırakıldı. Realtime isteniyorsa ilgili tabloları
`supabase_realtime` yayınına eklemek ve istemciye abonelik yazmak ayrı bir iştir; çalışıyormuş gibi gösterilmedi.

## Bu dizindeki dosyalar

| Dosya | Amaç |
|---|---|
| `export/export_live_schema.sql` | Canlı şemayı çalıştırılabilir SQL olarak çıkarır (salt okunur) |
| `verify/readiness_check.sql` | Hedef projeyi denetler (salt okunur) |
| `migrations/20261001_baseline_inferred_schema.sql` | Koddan çıkarılmış temel şema (yeni) |
| `migrations/` | Diğer 27 migration (değiştirilmedi); sıra: `apply_order.txt` |
| `BASELINE_SETUP.md`, `apply_order.txt`, `apply_with_psql.sh` | Kurulum rehberi, sıra, isteğe bağlı psql betiği |
| `tests/local/` | YALNIZCA yerel atılabilir DB için smoke testi |
| `tests/` | Mevcut salt okunur SQL kontrolleri (değiştirilmedi) |
| `functions/` | Edge Function'lar (değiştirilmedi) |

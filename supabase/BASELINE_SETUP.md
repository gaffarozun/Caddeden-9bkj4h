# Caddeden · Boş Supabase projesi için temel şema kurulumu

> **Durum:** Bu SQL dosyaları **hedef Supabase projesinde (`caddeden`) ÇALIŞTIRILMADI.** Yalnızca yerel PostgreSQL 16 +
> Supabase benzeri `auth`/`storage` iskeletinde denendi (bkz. "Doğrulama"). Gerçek projede sonucu siz doğrulayacaksınız.
>
> **Temel şema OnSpace'in gerçek şemasından alınmadı.** Uygulama kodundan (`from()`, `rpc()`, `storage`, Edge Function'lar)
> ve 27 migration'ın beklentilerinden çıkarıldı. Kaynak şemaya erişim olmadığı için "Doğrulanamayanlar" bölümüne bakın.
> `export/export_live_schema.sql` boş hedefte şema çıkarma yöntemi olarak **kullanılmaz** (yalnızca kaynak OnSpace veritabanında salt okunur çalıştırılabilir).

## 1) SQL Editor'a yapıştırma sırası

Her dosyayı SQL Editor'da **tek tek, bu sırayla** çalıştırın. Alfabetik sıra **yanlıştır** (ör. `20261020_account_type_decisions`,
`20261020_account_role_separation` ve `20261020_independent_stars` öncesinde bağımlılık ister). `supabase db push` kullanmayın:
aynı `20261020` önekini taşıyan dosyalar sürüm çakışması yaratır. Makine okunur liste: [`apply_order.txt`](apply_order.txt).

| # | Dosya (`supabase/migrations/`) |
|---|---|
| 1 | `20261001_baseline_inferred_schema.sql` ← **yeni temel şema** |
| 2 | `20261020_independent_stars.sql` |
| 3 | `20261020_account_role_separation.sql` |
| 4 | `20261020_account_type_decisions.sql` |
| 5 | `20261020_account_decision_relationship.sql` |
| 6 | `20261020_account_rating_state.sql` |
| 7 | `20261020_customers_without_approval.sql` |
| 8 | `20261020_business_account_approval.sql` |
| 9 | `20261020_feedback_criteria.sql` |
| 10 | `20261020_paid_campaign_ticker.sql` |
| 11 | `20261020_university_messages.sql` |
| 12 | `20261021_cadde_tv.sql` |
| 13 | `20261021_cadde_tv_broadcast_timezone.sql` |
| 14 | `20261022_menu_product_search.sql` |
| 15 | `20261022_university_withdrawal.sql` |
| 16 | `20261023_cafe_photo_privacy.sql` |
| 17 | `20261023_content_order_messages.sql` |
| 18 | `20261023_next_open_order_ratings.sql` |
| 19 | `20261023_order_reports.sql` |
| 20 | `20261024_cafe_seating_social.sql` |
| 21 | `20261024_cafe_venue_page.sql` |
| 22 | `20261024_cafe_arrival_prompt.sql` |
| 23 | `20261024_venue_presence_40m_privacy.sql` |
| 24 | `20261024_venue_social_mutual_instagram.sql` |
| 25 | `20261024_all_business_participation.sql` |
| 26 | `20261025_venue_live_inbox.sql` |
| 27 | `20261025_venue_refresh_serialization.sql` |
| 28 | `20261026_venue_radius_50m.sql` |
| 29 | `verify/readiness_check.sql` ← sonuçta **FAIL satırı kalmamalı** |

Notlar:
- Baseline dosyası başında bir koruma bloğu içerir: `account_admin()`, `business_star_ratings` veya `cafe_rooms` zaten varsa
  **hata verip durur** (dolu/yarım bir projenin üzerine yazmaz). Canlı veriyi silmez, sıfırlamaz.
- Bağımlılıklar: sıra 2–8 arası dosyalar birbirine bağlıdır; `20261020_feedback_criteria` baseline'daki
  `feedback_read/feedback_write/feedback_ratings/feedback_actor` gövdelerini metin değiştirerek yamalar, bu yüzden baseline'dan önce çalışamaz.
- psql tercih ederseniz: `HEDEF_DB_URL='postgresql://…' ./supabase/apply_with_psql.sh` (bağlantı dizesini depoya yazmayın).

## 2) Baseline ne oluşturur (kodun gerektirdiği kadar)

- **Tablolar:** `user_profiles`, `app_config`, `admin_logs`, `admin_alerts`, `businesses`, `menu_items`, `ad_packages`, `ads`,
  `business_posts`, `campaigns`, `notification_requests`, `notifications`, `payments`, `orders`, `reservations`,
  `business_reviews`, `business_suggestions`, `suggestion_supports`, `feedback_rate_limits`, `complaints`, `account_deletion_requests`
  (yabancı anahtar, `check` kısıtı ve indeksleriyle).
- **Tetikleyiciler:** `auth.users` → `handle_new_user` (profil oluşturur, `caddeden.app@gmail.com` doğrulanınca admin);
  `protect_user_profile_cols` (rol/durum/e-posta değiştirilemez), `protect_business_cols` (onay/yayın/öne çıkarma alanları istemciden yazılamaz),
  `protect_ad_insert`, `protect_post_write` (fiyat/durum paketten gelir), `protect_notification_request_insert`, `admin_alert_on_insert`, `set_updated_at`.
- **RPC:** `feedback_read/write/ratings/actor/throttle/admin_read/admin_allowed/begin_account_deletion/delete_account_data`.
- **RLS:** tüm tablolarda açık; önce tüm yetkiler geri alınır, sonra asgari yetki verilir (`user_profiles` için yalnızca
  `username, first_name, last_name, gender, phone, address, lat, lng, school_name, education_status` sütunları güncellenebilir).
  Politikalar `base_*` adını taşır. Bir işletme yalnızca `owner_id = auth.uid()` satırlarını değiştirebilir; yönetici yetkisi yalnızca
  `account_admin()` (doğrulanmış `caddeden.app@gmail.com`) ve Edge Function'larda service role ile kullanılır.
- **Storage:** `business-media` (herkese açık okuma, 10 MB, jpeg/png/webp; yazma yalnızca ilk klasör adı = sahibi olunan işletme id'si) ve
  `feedback-evidence` (özel, 5 MB). `cafe-profile-photos` kovasını `20261023_cafe_photo_privacy.sql` oluşturur.

## 3) Supabase Dashboard adımları

1. **Authentication → Providers → Email:** açık; *Confirm email* açık.
2. **Authentication → Email Templates:** *Confirm signup* ve *Magic Link* şablonlarına `{{ .Token }}` ekleyin (uygulama e-posta **kodu** bekler).
   Şifre sıfırlamada kod gösterilecekse *Reset Password* şablonuna da ekleyin. *Email OTP Length* = 6 (uygulama varsayılanı).
3. **Authentication → URL Configuration → Redirect URLs:** `onspaceapp://password-reset` (+ web kullanıyorsanız site adresiniz).
4. **Authentication → SMTP:** üretimde özel SMTP tanımlayın (yerleşik servis sınırlıdır).
5. **Storage:** `business-media`, `feedback-evidence`, `cafe-profile-photos` kovalarının SQL ile oluştuğunu doğrulayın (elle oluşturmayın).
6. **Yönetici:** `caddeden.app@gmail.com` ile uygulamadan kayıt olun ve e-postayı doğrulayın → rol otomatik `admin` olur.
7. **`admin_bootstrap_code`** (isteğe bağlı, admin-kurulum ekranı için) elle ve **güçlü rastgele** bir değerle oluşturulur; depoya yazmayın:
   ```sql
   insert into public.app_config(key,value) values ('admin_bootstrap_code','<güçlü-rastgele-değer>')
   on conflict (key) do update set value = excluded.value;
   ```
8. **Reklam paketleri:** `ad_packages` boş gelir (tohumlanmadı). Fiyatlar yönetici ekranından tanımlanmalıdır; paket yoksa reklam/içerik/bildirim
   başvurusu tetikleyicilerde reddedilir.

## 4) Edge Function'lar

İhtiyaç duydukları tablolar/yetkiler: `admin-api` (service role: `user_profiles`, `businesses`, `ads`, `campaigns`, `business_posts`, `notification_requests`,
`notifications`, `payments`, `ad_packages`, `admin_logs`, `admin_alerts`, `app_config`, `complaints`, `account_deletion_requests`, auth admin API),
`feedback-api` (`feedback_*` RPC'leri, `business_reviews`, `business_suggestions`, `complaints`, `feedback-evidence`), `rating-api` (`submit_*_rating`, `business_star_*`),
`media-maintenance` (`media_cleanup_queue`, `business-media`, `creative_is_referenced`). JWT'yi kodda doğrularlar.

```bash
supabase link --project-ref <proje-ref>
supabase functions deploy admin-api feedback-api rating-api media-maintenance
```
Ortam değişkenleri: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase tarafından **otomatik** sağlanır; ek sır gerekmez.
`service_role` anahtarını `.env`'e, istemci koduna veya GitHub'a koymayın. İstemcide yalnızca `EXPO_PUBLIC_SUPABASE_URL` ve publishable/anon anahtar kullanılır.

## 5) Doğrulama

**Hedefte:** `verify/readiness_check.sql` (salt okunur). Beklenen: FAIL yok. Kabul edilebilir WARN: yönetici henüz yok; `anon` için çalıştırılabilir
`SECURITY DEFINER` fonksiyonlar (genel okuma RPC'leri); `anon` tablo yetkisi uyarısı (RLS engeller).

Ek sorgular:
```sql
select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity;  -- 0 satır
select id, public from storage.buckets order by id;  -- business-media=true, feedback-evidence=false, cafe-profile-photos=false
select tablename, policyname, cmd from pg_policies where schemaname in ('public','storage') order by 1,2;
select has_column_privilege('authenticated','public.user_profiles','role','UPDATE');  -- false
```

**Yerelde yapılanlar** (gerçek projede değil): PostgreSQL 16'da baseline + 27 migration sırayla hatasız uygulandı;
`tests/local/baseline_smoke_LOCAL_ONLY.sql` 144 kontrolün 144'ünü geçti (RLS, sahiplik, rol/durum koruması, fiyat/durum zorlaması, feedback RPC'leri,
storage politikaları). `readiness_check.sql` dolu yerel veritabanında FAIL=0, boş veritabanında hatasız çalışıp FAIL üretiyor.
`tests/local/` dosyasını yalnızca **atılabilir yerel** veritabanında çalıştırın (veri ekler/siler).

Mevcut `tests/*_read_only.sql`: boş veritabanında 6 dosya, mevcut yönetici/işletme verisi bulunmadığı için ("Existing administrator unavailable",
"İşletme bulunamadı") hata/false verir; 3 dosya (`all_business_participation`, `cafe_seating_social`, `cafe_venue_page`) ise ara sürümlerin kaynak metnini
aradığı için son durumda başarısızdır. Bunlar beklenen ve baseline hatası değildir.

## 6) Doğrulanamayanlar / bilinen eksikler

- **Kaynak şema yok:** sütun adları/tipleri/kısıtlar koddan çıkarıldı. OnSpace'te ek sütun, farklı tip veya ek kısıt olabilir; veri taşırken uyuşmazlık çıkarsa bu dosya düzeltilmelidir.
  Veri taşınmayacağı için (kullanıcı kararı) risk düşük, ama kodun hiç kullanmadığı sütunlar yoktur.
- **Eksik görsel:** `assets/images/caddeden-intro-night-street.webp` depoda yok (`CaddedenIntro.tsx` bunu `require` eder); bundler bu dosya olmadan derlemez. OnSpace'ten alınıp eklenmeli.
- **Derleme/uygulama testi yapılmadı:** npm kayıt defterine erişim yok; `tsc`, lint, Expo derlemesi ve cihaz akışları denenmedi.
- **Gerçek Supabase davranışı:** `auth`/`storage` yerel iskeletle taklit edildi; GoTrue, Storage API, PostgREST şema önbelleği ve Edge Function çalışması gerçek projede denenmedi.
- **Yönetici e-postası** SQL ve Edge Function'larda sabit (`caddeden.app@gmail.com`).
- **Realtime yok** (uygulama polling kullanır). **Stripe entegre değil**; ödemeler yönetici onayında manuel kayıt.
- **Hesap silme:** `cafe-profile-photos` kovasındaki dosyaları temizleme baseline'da yok (yalnızca veritabanı kayıtları anonimleştirilir/silinir).
- **`ad_packages` tohumlanmadı**; `app_config` yalnızca elle girilen değerleri içerir.
- Hesaba bağlı derin bağlantı şeması `onspaceapp://` olduğu gibi bırakıldı.

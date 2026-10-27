# Kullanıcı Yönetimi ilişki belirsizliği düzeltmesi

Tarih: 20 Ekim 2026

## Kesin olarak belirlenen hatalı sorgu

`app/admin/users.tsx` → `adminApi.listUsers()` → `admin-api`, `list_users` işlemi.

`supabase/functions/admin-api/index.ts` içinde `user_profiles` sorgusundaki `businesses(id)` ilişkisi açıkça seçilmemişti. `admin-api` günlüklerinde aynı `user_profiles` / `businesses` ilişki belirsizliği mesajıyla HTTP 400 yanıtları doğrulandı.

## Mevcut şema incelemesi

PostgreSQL kataloglarından doğrulanan doğrudan sahiplik ilişkisi:

- Constraint: `businesses_owner_id_fkey`
- Kaynak: `public.businesses.owner_id`, nullable UUID
- Hedef: `public.user_profiles.id`, primary key UUID
- Silme davranışı: `ON DELETE SET NULL`

Bu iki tablo arasında tek doğrudan foreign key bulundu; ikinci bir doğrudan foreign key olduğu varsayılmadı. Mevcut `business_star_ratings` tablosunun `(business_id, user_id)` birleşik primary key'i ve iki foreign key'i ayrıca PostgREST'in çoktan çoğa ilişki keşfine uygun bir dolaylı yol sağlar. Bu tablo ve ilişkileri değiştirilmedi. Hesap türü ilişkisi için mevcut `account_type_decisions(user_profiles)` computed relationship de doğrulandı ve korundu.

## En küçük uygulama değişikliği

Yalnızca `list_users` sorgusundaki aşağıdaki parça değiştirildi:

```text
Önce: businesses(id)
Sonra: businesses!businesses_owner_id_fkey(id)
```

Yanıttaki `businesses` alanı ve `{ id }[]` yapısı korunur. Böylece işletmeler puanlama ilişkisinden değil, yalnızca `owner_id` sahipliğinden listelenir. `role`, hesap türü kararı ve işletme giriş onayı işleme mantığı aynen bırakıldı; bağlı işletmesi bulunan kullanıcılar otomatik olarak işletme hesabına dönüştürülmedi.

## Yapılan doğrulamalar ve sınırlar

Değişiklikten sonra salt okunur SQL kontrolleri çalıştırıldı:

- Constraint adı ve gerçek kaynak/hedef kolonları doğrulandı.
- Sahiplik join'i ve mevcut hesap türü fonksiyonuyla SQL liste projeksiyonu: 4 profil, 4 benzersiz profil; 3 kullanıcı, 1 yönetici, 0 işletme rolündeki profil.
- Sahiplikten gelen toplam 3 işletme bağlantısı, `owner_id` dolu işletme sayısıyla eşleşti. Toplam 11 işletme kaydı korunuyor; sahipliği olmayan kayıtlar kullanıcıya atanmadı.
- İşletme olmayan profillere giriş onayı eklenmedi.
- Mevcut yetkili yönetici için SQL JWT claim simülasyonuyla `account_admin()` doğrulaması geçti; kimliksiz çağrıda yönetici yetkisi verilmedi.
- Yönetici karar RPC'leri authenticated istemciye kapalı, service role için açık kalıyor.
- Önce/sonra foreign key, RLS politika ve yönetici rol/durum özetlerinin hash'leri birebir eşleşti; profil/işletme sayıları ve rol dağılımı değişmedi.

Bu SQL kontrolleri, gerçek bir Supabase/PostgREST isteği veya canlı yönetici oturumu ile ekran testi değildir. Live Preview ağ kaydı bulunmadığı ve araçlarla mevcut yönetici oturumunda işlem başlatılamadığı için güncellenmiş `list_users` Edge Function yanıtı ve ekranın yüklenmesi henüz uçtan uca doğrulanamadı. Mevcut işletme rolünde profil bulunmadığı için işletme hesabı listeleme senaryosu da gerçek hesapla test edilmedi; test hesabı oluşturulmadı.

Yayınlanan değişiklikten sonra mevcut yönetici hesabıyla Kullanıcı Yönetimi ekranını yenileyerek HTTP 400'ün kalktığı, mevcut profillerin listelendiği ve onay/rol kontrollerinin yerinde kaldığı doğrulanmalıdır. Başka bir hata çıkarsa tam API yanıtı ve günlükler incelenmeden ek şema değişikliği yapılmamalıdır.

Hiçbir tablo, kayıt, foreign key, RLS politikası, hesap, rol veya yönetici yetkisi silinmedi, sıfırlanmadı ya da değiştirilmedi. Yeni foreign key veya migration oluşturulmadı.

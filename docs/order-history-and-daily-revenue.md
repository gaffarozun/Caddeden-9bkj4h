# Sipariş geçmişi ve günlük ciro

- Keşfet ekranındaki Caddeden başlığının ve Gönderiler ekranı başlığının alt açıklamaları kaldırıldı.
- İşletmeler: Gelen Talepler veya İşletmelerim → Sipariş Geçmişi ve Günlük Ciro.
- Yönetici: Yönetici Paneli → Tüm Siparişler ve Ciro. Mevcut reklam/ödeme gelir raporu ayrı kalır.
- Varsayılan bugün. Son 7 gün, bu ay, tüm tarihler veya YYYY-AA-GG biçiminde özel tarih aralığı seçilebilir. Her iki tarih dahildir.
- İşletme ve sipariş durumu filtreleri; tarih veya tutara göre artan/azalan sıralama vardır.
- Sipariş görünümü müşteri, kesin tarih/saat, ürünler, tutar, adres, telefon, not ve durumu gösterir; durum değiştirme mevcut gelen talepler ekranında kalır.
- Günlük ciro görünümü tarih başına sipariş sayısı, teslim edilen sayısı ve ciroyu gösterir. Günler Europe/Istanbul saat diliminde **sipariş oluşturma tarihine** göre gruplanır. Tabloda teslim zamanı/tahsilat alanı olmadığı için bunlar uydurulmaz.
- Ciro sadece `delivered` durumundaki siparişlerin toplam brüt tutarıdır; gerçek tahsilat, komisyon sonrası kazanç veya muhasebe raporu değildir. Bekleyen/onaylı/yola çıkan/reddedilen siparişler ciroya girmez.
- Özetler tüm aktif filtrelere uyan kayıtları kapsar. Sipariş ve gün listeleri 30 kayıtlık sayfalarla tüm geçmişe eriştirir; liste sayfası toplam ciroyu kısıtlamaz.

## Güvenlik ve veri koruma

Eklemeli migration `20261023_order_reports.sql` yalnızca rapor fonksiyonları ve indeksler ekler. Mevcut kayıtlar, orders RLS, sipariş geçişleri ve ödeme defteri değişmez.

`business_order_report` aktif ve onaylı işletme hesabını sunucuda doğrular; kapsam her zaman `auth.uid()` sahibine ait işletmelerdir. İstemci başka işletme kimliği gönderse de başka sahibin verisini alamaz.

`admin_order_report` sadece service_role tarafından çağrılabilir; admin-api mevcut JWT/rol/e-posta kontrolünden sonra sunucu doğrulamalı yönetici kimliği ile çağırır. Ham `order_report_data` anon/authenticated rollerine kapalıdır.

Raporlar ilk girişte, filtre/sayfa değişince ve kullanıcı aşağı çekince yenilenir. Bu değişiklik Keşfet/Gönderiler yenileme davranışını değiştirmez.

## Kontroller

`supabase/tests/order_reports_read_only.sql`: fonksiyon izinleri, RLS korunması, tam kayıt toplamı, yalnızca teslim edilmiş ciro, günlük gruplama, boş sahip kapsamı ve 30 kayıt sayfalama.
`tests/orderReportChecks.ts`: Türkiye gece yarısı, kesin tarih/saat, 7 günlük aralık, ay başlangıcı, geçerli takvim tarihleri ve ters aralık doğrulama.

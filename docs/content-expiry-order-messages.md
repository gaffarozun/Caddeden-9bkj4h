# İçerik onayı, görsel süresi ve sipariş mesajları

## Kullanıcı ekranları
- Keşfet, Gönderiler ve Cadde TV üst başlığındaki yenile simgeleri kaldırıldı. Keşfet/Gönderilerde aşağı çekerek kullanıcı yenilemesi korunur; hata halinde yeniden deneme mümkündür. Akışlar kendiliğinden yeniden sıralanmaz.
- Süresi dolan gönderiler mevcut açık akıştan sadece çıkarılır; yeni akış yüklenmez ve kalan sıra değiştirilmez.
- Profil > Şikâyet / Sorun Bildir ve talep geçmişindeki şikâyet bağlantısı, konu ve açıklama formunu açar.
- Yönetici > Şikâyet E-posta Adresi bölümünde alıcı adresini belirlemek gerekir. Henüz adres yoksa kullanıcıya açıkça gösterilir. Yönetici giriş e-postası ve yetkisi değişmez.
- Gönderim `mailto:` ile cihazın e-posta uygulamasını açar. Bu bir taslaktır; kullanıcı e-posta uygulamasında Gönder'e basar. Otomatik e-posta, sahte başarı mesajı veya e-posta teslimat iddiası yoktur.

## Yönetici
- İçerik Onayı: Gönderi & Cadde TV / Kampanyalar / Reklamlar sekmeleri.
- Durum, ödeme filtresi ve sıralama ayrı: Tüm ödemeler / Ödenenler / Ödenmeyenler; En yeni / Ödenenler önce / Ödenmeyenler önce.
- Yalnızca reddedilmiş satırda Sil vardır. Onay kutusu, server-side yönetici kimliği ve koşullu `status=rejected` silme birlikte korunur. Ödeme defteri ve işletme hesabı silinmez; otomatik iade yapılmaz. Denetim kaydı bırakılır.
- Silinen içeriğin yalnızca özel content/ads/campaigns klasöründeki, başka kayıtta kullanılmayan fotoğrafı silinir. Logo, menü, galeri ve harici URL korunur.

## Görsel süresi
- Yayın günleri Europe/Istanbul takvimine göre; son yayın günü dahildir, sonraki gece yarısında yayın sona erer.
- Süreli reklam/içerik onayında günler yönetici paketinden server-side alınır. Süresi kaldırılmış görsel yeniden onaylanamaz; yeni başvuru gerekir.
- Public RLS ve mevcut Cadde TV RPC, süresi dolan içeriği yayınlamaz. Finansal ve moderasyon kaydı tutulur; süre sonunda kayıt değil yalnızca fotoğraf URL'si temizlenir.
- `media-maintenance` Edge Function sadece sunucunun süresi dolmuş olarak belirlediği kayıtları temizler; istemciden tablo, fotoğraf yolu veya tarih kabul etmez. Her çalışmada 30 kayıt/tablo, 30 bekleyen dosya sınırı vardır.
- Fotoğraflar güvenli bir retry kuyruğuna alınır. Başka içerikte/işletmede/menüde kullanılan dosya korunur. Storage hatasında URL kaldırılmış kalır ve sonraki çalışmada dosya yeniden denenir.
- Uygulama açıkken root hook ilk açılış, foreground ve 60 saniyelik aralıklarla bu işlevi çalıştırır. Bu bir sunucu cron değildir.
- Bu Cloud veritabanında `pg_cron` etkinleştirilemedi (`can only create extension in database postgres`). Uygulama kapalıyken fiziksel dosya silinmesi garanti edilmez. Kapalıyken temizleme için ayrı, güvenli bir zamanlayıcıdan `media-maintenance` işlevine POST gönderilmelidir; bu oturumda böyle bir zamanlayıcı kurulmadı. Süresi dolmuş yayınların public görünürlüğü zamanlayıcıya bağlı değildir.
- Dış/CDN/cihaz önbelleklerinin anında temizleneceği iddia edilmez. Tarihsiz eski içeriklere süre uydurulmaz.

## Siparişler
- Akış: Bekleyen → Onaylı/Hazırlanıyor → Yola çıktı → Teslim edildi. Bekleyen/onaylı ret, mevcut reddedilmiş talebin yeniden onayı korunur.
- Yola çıktıktan sonra ret veya direkt Onaylı → Teslim edildi geçişi veritabanında reddedilir; RLS işletme sahipliğini korur.
- `order_messages`: yalnızca alıcı kendi mesajını okur ve `read_at` alanını günceller. İstemci mesaj/durum üretemez. INSERT ve durum değişimi DB trigger'ından kalıcı mesaj oluşturur. Eski siparişlere veri taşıması yapılmaz; sonraki durum değişimi mesaj oluşturur.
- Root Provider, kullanıcı oturumu/rolü değiştiğinde kuyruğu temizler; misafir/işletme/şifre kurtarma oturumlarında müşteri mesajı göstermez.
- Uygulama açıkken 10 saniyede bir polling; arka planda durur. En son mesaj, hangi standart uygulama ekranı açık olursa olsun üstte baloncuk olarak görünür. Intro ve şifre kurtarma ekranlarında gizlenir.
- Baloncuk kapatıldığında/görüntülendiğinde o siparişin önceki mesajları da okunur sayılır; eski durumlar tekrar görünmez. Bildirim ayarı kapalıysa baloncuk gösterilmez, mesajlar korunur.
- Bu uygulama içi bildirimdir; uygulama kapalıyken işletim sistemi push bildirimi göndermez. Kapsam gerçek cihazda ayrıca test edilmelidir.

## Kontroller
- `supabase/tests/content_order_messages_read_only.sql`: özel mesaj izinleri, durum trigger'ları ve görsel görünürlük politikaları.
- `tests/contentAndOrderChecks.ts`: ödeme filtreleri, sıralama değişmezliği, İstanbul takvimi ve dosya yolu güvenliği. Test runner bu oturumda çalıştırılmadı.

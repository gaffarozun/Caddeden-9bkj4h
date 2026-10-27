# Masa planı, tahmini doluluk ve Instagram istekleri

## İşletme ayarları
- İşletme Sayfam → İsteğe bağlı mekân katılımı kullanıcı profillerini açar/kapatır. Masa planı ve tahmini doluluk bağımsız seçenektir. Tüm kategoriler desteklenir; mevcut işletmeler kendiliğinden açılmaz.
- Masa planı 6×10 alanda en fazla 60 masa, masa başına 1–12 kişilik kapasite içerir. Gösterimi açmadan önce en az bir masa eklenir ve Kaydet seçilir. İşletmenin gerçek konumu kaydedilmelidir.
- Masa kayıt hatası için eski JSON değişkeni/SQL alias çakışması kaldırıldı. İstemci JSON planını text taşıma RPC'si üzerinden gönderir; sunucu JSON'a çevirip doğrular ve atomik kaydeder. Konumlar değiş tokuş edilse de geçici unique çakışması oluşmaz. Başka işletmenin masasını kullanmak yasaktır.
- Kullanıcı 40 metreden yakın konumda onay verdiğinde işletme sayfasının Doluluk ve Mekândakiler düğmesinde yalnızca tahmini yüzde, oran çubuğu ve profiller açılır. Müşteri ekranından masa planı çizimi ve uzun açıklamalar kaldırılmıştır. Oran onaylı aktif kullanıcı sayısı / masa kapasitesidir; kesin fiziksel doluluk değildir. Kapasite hesabı için işletmenin özel masa editörü ve kayıtları korunur.
- Doluluk açık, sosyal katılım kapalıysa doluluk yüzdesi kullanılabilir fakat fotoğraf/Instagram paylaşımı açılmaz. Her iki seçenek kapalıysa müşteriye düğme/bulut gösterilmez.

## Profiller ve Instagram
- Genel profil görünürlüğü hesap bazında kapatılabilir; her yeni girişte ayrıca Göster/Gizle sorulur. Görünür profilde ad + sansürlü soyad ve varsa özel fotoğraf gösterilir. Gizli profiller yalnızca Kullanıcı kartıdır.
- Instagram kullanıcı adı isteğe bağlıdır; OAuth ile doğrulanmış Instagram hesabı değildir. Ancak kullanıcı adı eklemeyen kişi istek gönderemez veya onay veremez. Her iki tarafın kayıtlı, geçerli kullanıcı adı sunucuda kontrol edilir; istemci de gönderme/onaylama eylemlerini kapatır. Reddetmek kullanıcı adı gerektirmez. Fotoğraf yüklenmiş olması şart değildir.
- Tek isteğin onaylanması iki tarafa karşılıklı erişim sağlar. Gönderen alıcının, alıcı gönderenin Instagram bağlantısını aynı istek kimliğiyle açar; ikinci bir istek gerekmez. Alıcı için gelen onaylı istekte ve görünür katılımcı kartında Instagramı aç eylemi bulunur.
- Bağlantı yalnızca açık eylemde sunucudan alınır. Sunucu isteğin onaylı olmasını, çağıranın iki katılımcıdan biri olmasını, iki kullanıcı adını, aynı mekânda aktif katılımı, karşı tarafın profil görünürlüğünü ve ret süresini tekrar doğrular. Genel/per-entry gizlilik ve konumdan ayrılınca erişim engelleri korunur. Başka biri veya kullanıcı adı olmayan hesap onaylı bir isteğin kimliğini bilse bile bağlantıyı alamaz.
- Ret/izin kaldırma, alıcının ad ve fotoğrafını gönderen kişiden 7 gün gizler; alıcı mekânda yalnızca Kullanıcı olarak kalır. Bu süre boyunca yeni istek gönderilemez. Eski kararlar yeniden yazılmaz; 7 günlük etkili süre karar tarihinden hesaplanır.
- Gönderen kendi farklı alıcı sayısını görür. Her gelen istekte gönderenin toplam kaç farklı kişiye istek yolladığı gösterilir; diğer kişilerin kimlikleri paylaşılmaz. Aynı alıcıya tekrar gönderim farklı kişi sayısını artırmaz.
- Saatlik mevcut 10 istek koruması ve kendine istek yasağı korunur. Gönderen bazında transaction lock eşzamanlı farklı kişilere gönderimlerle sınırın aşılmasını engeller. Bekleyen/onaylı çift isteği yeniden üretilmez.

## Güvenlik ve test
- Özel fotoğraflar aynı mekân, görünürlük ve ret süresiyle kontrol edilir. 10 saniyelik polling ve arka plan temizliği korunur. Müşteri koordinatları saklanmaz.
- supabase/tests/venue_presence_40m_privacy_read_only.sql: 40 m sözleşmesi, 7 gün, maskeli isim, anonim çıktı, farklı alıcı sayıları, RLS ve RPC sınırları.
- supabase/tests/venue_mutual_instagram_read_only.sql: iki tarafın kullanıcı adı zorunluluğu, karşılıklı bağlantı, üçüncü taraf/anonim yetki sınırları ve gizlilik kontrolleri. Dağıtılmış sözleşme için salt-okunur SQL regresyonu çalıştırılmıştır; gerçek cihaz testinin yerine geçmez.
- tests/cafeSeatingSocialChecks.ts: onaylı gelen/giden isteğin tek kimlikle seçilmesi, boş kullanıcı adı ve doluluk sınırları için ek senaryolar.
- Gerçek cihazda iki hesapla konum, genel/per-entry görünürlük, istek sayıları, kabul/ret, ayrılma, süre dolumu ve işletme kapatması ayrıca test edilmelidir.

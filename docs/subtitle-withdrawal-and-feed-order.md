# Altyazı kaldırma ve karışık akışlar

## Altyazılar
- Öğrenciler Cadde TV → Yazını gönder → Yazı isteklerin bölümünden kendi bekleyen, onaylı veya reddedilmiş yazılarını onay diyaloğuyla kaldırabilir.
- Yönetici Cadde TV Yazı Onayları ekranında yazıları kaldırabilir; “Kaldırılan” filtresi yazar/yönetici tarafından kaldırılan kayıtları gösterir. Bekleyen taleplerin gerekçeli reddi korunur.
- Kaldırma fiziksel silme değildir: `withdrawn_at` ve `withdrawn_by` eklenir, özgün metin ve moderasyon kararı korunur. Mevcut kayıtlar bu geliştirme oturumunda değiştirilmedi veya silinmedi.
- `withdraw_university_message(uuid)` JWT’den `auth.uid()` kullanır. Yalnızca yazar veya mevcut yetkili `account_admin()` sonucu doğru olan yönetici kaldırabilir. Kimlik istemci parametresi değildir; anonim işlem ve diğer yazarın yazısını kaldırma engellenir.
- Tekrarlanan kaldırma güvenlidir. Moderasyon ve kaldırma aynı satırı kilitler; tetikleyici kaldırılmış yazının yeniden yayınlanmasını/geri getirilmesini engeller. Yazı tekrar yayınlanmak istenirse yeni moderasyon isteği gerekir.
- Kamu projeksiyonu yalnızca kaldırılmamış onaylı yazıları döndürür; özel profil bilgileri açılmaz. RLS ve mevcut yönetici/hesap izinleri korunur. Kaldırılan bekleyen yazı üç istek sınırına dahil edilmez; bir dakikalık gönderim kısıtı devam eder.
- Başarılı kaldırma aynı uygulama oturumunda ortak UniversityContext’ten hemen çıkarılır. Eski ağ yanıtları yazıyı yeniden ekleyemez. Diğer açık cihazlar sonraki 30 saniyelik sorguda veya sayfaya dönüşte güncellenir; canlı abonelik kullanılmaz.

## Akış sıralaması
- `services/feedOrderService.ts` Fisher–Yates karıştırması ve kimlik tabanlı karışık sıra uzlaştırması içerir. Veritabanında yayın sırası, onay, fiyat veya ödeme kararı değiştirilmez.
- Keşfet “Önerilen” alanı her odaklanmada/elle yenilemede karıştırılır. Açık işletme, isim, puan ve kayıt tarihine dayalı sabit öncelik yoktur. Kullanıcının seçtiği yüksek/düşük puan sıralaması, kategori/arama ve sadece açık filtresi korunur.
- Gönderiler yeni odaklanmada/elle yenilemede karıştırılır. Önceden var olan demo gönderiler korunur ve gerçek gönderilerle aynı rastgele sıraya dahil edilir.
- Güncel kampanyalar ortak sağlayıcıda her yeni hesap/misafir oturumunda karıştırılır; işletme profilindeki kampanyalar da yüklenirken karıştırılır. Otomatik sorgular mevcut kampanya sırasını zıplatmaz; yeni kayıtlar rastgele konuma girer, süresi dolan kayıtlar çıkar.
- Cadde TV aynı ortak uzlaştırmayı kullanır. Sponsorlu veya yeni görsellerin sabit önceliği yoktur; mevcut kanal kimliği korunur, yeni görseller rastgele konuma eklenir. 7 saniye, manuel ileri/geri ve kanal geçiş efekti değiştirilmedi.
- Karıştırma render/arama/tema değişiminde tekrarlanmaz. Rastgelelik kişisel verilerden bağımsızdır; iki izleyicinin tesadüfen aynı sırayı alması mümkündür. Sunucunun mevcut uygunluk filtreleri ve liste boyutu sınırları korunur.

## Doğrulama
- Canlı veritabanında ek migration uygulandı; izin/RLS, kamu projeksiyonu, oturumsuz işlem ve başka yazarın yazısını kaldırma için salt okunur/yalnızca reddedilen işlem kontrolleri başarılı oldu. Mevcut yönetici aktif ve dört eski mesaj kaydı korunmuş durumda.
- `supabase/tests/university_withdrawal_read_only.sql` aynı denetimleri içerir. Başarılı sahip/yönetici kaldırma ve kaldırma/onay yarışını gerçek cihazlarda test etmek gerekir; geliştirme sırasında mevcut yazılar kaldırılmadı.
- `tests/feedOrderChecks.ts` bağımsız TypeScript kontrolleri eklendi; bu oturumda TypeScript test çalıştırıcısı/derleme/cihaz testi çalıştırılamadı.
- Cihaz kontrolü: kendi yazını kaldır, vazgeç, çift basış; başka hesap kaldırmayı deneyemez; yönetici kaldırır ve Kaldırılan filtresinde görür; kaldırılmış yazı tekrar onaylanamaz; TV yazısı anında çıkar, başka cihaz sorgusunda kaybolur; karışık akışlar, puan ve kategori filtreleri; TV manuel önceki/sonraki, efekt sonrası yalnızca yeni fotoğraf.

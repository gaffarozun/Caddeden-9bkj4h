# Ücretli Güncel Kampanyalar LED bandı

## Görünüm ve yerleşim
- Kartlı kampanya alanı, Üniversiteden ile aynı 32 px başlık + 48 px yazı satırı, neon renkler, LED çizgileri ve 48 px/s kesintisiz sola kayma ile değiştirildi.
- Keşfet sırası: arama → Güncel Kampanyalar → Üniversiteden → ana kategori seçimi → alt kategoriler → işletmeler. Üniversiteden artık aramanın üstünde sabit değildir.
- Kampanya metni işletme adı ve kampanya başlığını içerir; dokununca işletme profili açılır. Bant kategoriyi takip eder; demo kampanyalar ücretli alana karıştırılmaz.
- Duraklatma, hareket azaltma ve arka plan/odak durdurma davranışları iki bantta ortaktır. Caddeden ayraçlarında taç bulunmaz.

## Yönetici tarafından yapılacak fiyat ayarı
- Mevcut `Kampanya · 30 Gün` paketinin fiyatı incelendi: 0 ₺. Bu kayıt değiştirilmedi; bilinmeyen bir ücret tahmin edilmedi.
- Yönetici → Paketler ve Fiyatlar → Kampanya paketi: sıfırdan büyük ücret belirle, gün sayısını seç, aktif tut ve kaydet.
- Ücretli paket yoksa işletme başvuru düğmesi pasiftir ve açıklayıcı bilgi gösterilir. Üniversiteden müşteri yazıları ücretsiz kalır.
- Yeni ücret yalnızca sonraki başvurulara uygulanır. Başvurunun tutarı ve `publication_days` yayın süresi sunucuda saklanır.

## İşletme başvurusu
- İşletme hesabı yönetici tarafından onaylanmış olmalıdır; yalnızca kendi işletmesi adına başvurur.
- 4–160 karakter başlık, isteğe bağlı en fazla 2000 karakter koşullar ve isteğe bağlı kırpılmış görsel.
- Ücret ve süre gösterilir; işletme bunları kabul edip yöneticiye gönderir. Paket fiyatı/süresi değişmişse sunucu eski teklifi reddeder ve yenileme ister.
- Başlangıç durumu `pending` + `unpaid`; başvuru bildirimi mevcut yönetici tetikleyicisi üzerinden oluşturulur.
- Başvuru listesi ücret, ödeme/onay durumu, yayın tarihleri ve ret notunu gösterir. Silme para iadesi değildir.

## Manuel ödeme ve yayın onayı
1. Yönetici ücreti uygulama dışında tahsil eder. Stripe veya başka otomatik tahsilat entegrasyonu eklenmedi.
2. İçerik Onayları → Kampanyalar → Ödemeyi doğrula. Onay diyaloğu ödemenin gerçekten alındığını sorar.
3. Ardından Onayla ve yayınla. Doğrulanmamış ödeme veya sıfır ücretli başvuru yayınlanamaz.
4. Yayın onay günü başlar; paket günü kadar sürer, son gün dahildir. Yeniden aynı onay çağrısı süreyi uzatmaz.
5. Ödeme doğrulaması kaldırılırsa yayın durur ve yeniden onay gerekir. Tarihsel ödeme kaydı korunur; otomatik iade yapılmaz.

## Sunucu sınırları
- Additive migration: `20261020_paid_campaign_ticker.sql`. Mevcut kampanyalar, hesaplar, işletmeler, paketler, ödeme geçmişi ve RLS politikaları silinmedi/değiştirilmedi.
- `campaign_pricing_guard`: yeni başvuruda paketin fiyatını/süresini sunucuda sabitler; istemci ödeme, fiyat, tarih veya yayın durumunu değiştiremez. Mevcut koruma tetikleyicileri korunur.
- `submit_paid_campaign`: sahiplik, hesap onayı, aktif ücretli paket ve gösterilen teklif kontrolü; paket satırı işlem boyunca kilitlenir.
- `admin_campaign_decision`: yalnızca service_role çağırabilir; yetkili yönetici ayrıca doğrulanır. Satır kilidi, beklenen durum kontrolü, ödeme kaydı ve denetim kaydı tek işlemdedir.
- `public_paid_campaigns`: yalnızca ödemesi doğrulanmış, onaylı, yayın süresi geçerli, onaylı/yayındaki işletme kampanyalarını sunar; veritabanı saatini kullanır ve özel alanları içermez.
- Yeni kısıtlayıcı SELECT politikaları eski permissive politikalarla kesişir; sahipler kendi başvurularını görmeye devam eder.
- Eski ücretsiz veya ödenmemiş kampanyalar veritabanında korunur ancak ücretli bantta gösterilmez. Sıfır ücretli eski başvuruda işletmenin yeni ücretli paketle yeniden başvurması gerekir.
- CampaignProvider tüm sayfalarda paylaşılır; gönderim ve yönetici kararı sonrası yenilenir. Diğer cihazlar 30 saniyelik polling ve odak/arka plandan dönüş ile güncellenir.

## Doğrulama ve kalan cihaz testleri
- Canlı veritabanında RLS, ücret tetikleyicisi, süre sütunu, public projection, anonim/müşteri izinleri, service-only moderasyon ve mevcut yönetici hesabının korunması read-only testlerle doğrulandı.
- Oturumsuz başvuru ve yetkisiz yönetici kararı hiçbir kayıt yazılmadan reddedildi.
- Başarılı ücretli başvuru/gerçek ödeme/yönetici onayı, native build ve cihaz görsel testleri bu oturumda çalıştırılmadı.
- Manuel kontrol: yönetici fiyat belirler → işletme başvurur → ödeme olmadan onay engellenir → ödeme doğrulanır → yayın onaylanır → bant görünür → işletme profili açılır → ödeme doğrulaması kaldırıldığında banttan çıkar.
- 320 px ekran, yatay ekran, duraklat/oynat, hareket azaltma, iki tam bant döngüsü ve yayın süresi dolması ayrıca cihazda kontrol edilmelidir.

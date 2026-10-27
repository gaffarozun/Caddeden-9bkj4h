# Caddeden müşteri deneyimleri ve hesap silme

## 20 Ekim 2026: bağımsız yarım yıldız puanlama ve deneyim onayı

Bu bölüm, aşağıdaki önceki sürümdeki işletme yıldızı/yorum kartı davranışlarının yerine geçer.

- Yorumlar ve müşteri deneyimleri kutucuğu **şimdilik kapalıdır** (`experience_feature_settings.enabled=false`). İşletme profilinde ve işletme yönetiminde kilitli görünür; doğrudan deneyim URL'si açıldığında da kapalı ekranı gösterilir. Deneyim okuma/yazma RPC'leri sunucuda aynı anahtarı denetler. Mevcut moderasyon, şikâyet ve hesap silme işlemleri korunur.
- Yönetici Paneli → Müşteri Deneyimleri → **Onayla ve kullanıma aç** anahtarı bu bölümü açar. Tek yetkili yönetici, doğrulanmış oturum ve mevcut rol/e-posta koşulları korunmuştur. Kapatma mevcut yorumları silmez. Özellik değişikliği ve yönetici logu tek transaction'da yazılır.
- İşletme profilinde **Müşteri puanı** kartı bağımsızdır: 0,5; 1; 1,5 … 5 seçenekleri, yarım yıldız önizlemesi ve tek gönderim. E-posta doğrulaması, aktif müşteri rolü, kısıtlama, işletme sahipliği ve hesap silme isteği sunucuda denetlenir. İşletme/yönetici/anonim hesaplar puan veremez.
- Yeni `business_star_ratings` tablosunda müşteri–işletme başına tek kayıt vardır. Puan güncellemesi aynı kaydı değiştirir; oy sayısını artırmaz. Kullanıcı başına 2 saniyelik yazma aralığı transaction kilidiyle korunur. Her müşteri eşit ağırlıktadır: ortalama = bütün güncel kullanıcı puanlarının toplamı / oy sayısı; gösterim bir ondalığa yuvarlanır. Hesap silme isteği bulunan kullanıcıların oyları kamu ortalamasına dahil edilmez.
- İşletme profilindeki başlık yıldızı, işletme kartları ve Keşfet yeni `business_star_stats` sonuçlarını kullanır. Eski `businesses.rating/review_count` alanları ve altı özellikli deneyim kayıtları değiştirilmez; altı özellik değerlendirmesi bağımsız yıldız ortalamasına karışmaz.
- Keşfet: Önerilen / En yüksek puan / En düşük puan seçenekleri. Puan sıralamasında gerçek ve puanlanmış işletmeler önce; puanı olmayanlar sonra; demo işletmeler en sonda. Eşit puanda oy sayısı, ardından ad kullanılır. Kategori, arama ve sadece açık filtresi korunur. Gerçek işletme kartında oy sayısı veya “Henüz puan yok”; örnek kartlarda “Demo” etiketi gösterilir.
- `RatingProvider` ortak durum paylaşır; gönderimden sonra profil ve Keşfet yenilenir. Aktif uygulamada 30 saniyelik polling kullanılır. İstemciye service-role anahtarı veya kullanıcı kimliği seçme yetkisi verilmez. RLS iki yeni tabloda da açıktır; doğrudan yazımlar kapalıdır, kişisel oylara yalnızca sahibi erişebilir.

### Bu oturumda doğrulananlar

- Gerçek anon rolüyle puan/özellik okuma: başarılı; `canRate=false`, `mine=null`.
- Gerçek authenticated veritabanı rolüyle service-only puan RPC'si ve özellik onay RPC'si: reddedildi.
- Kapalı deneyim RPC'sinin yorum gönderimi: 42501 ile, yazıma ulaşmadan reddedildi.
- 3,25 puan ve kimliksiz müşteri işlemi: reddedildi; gerçek oy eklenmedi.
- Salt okunur aritmetik fixture: 3,5 + 4 + 5 için ortalama 4,2. Yarım puan kısıtı, RLS, doğrudan INSERT/UPDATE yasağı, benzersiz anahtar ve kapalı varsayılan doğrulandı.
- 11 yayımlanmış işletmede yeni toplu puan okuması başarılı. Son envanter: 4 profil, 11 işletme, 3 sipariş, 2 rezervasyon, 1 yönetici; 0 eski değerlendirme ve 0 yeni oy. Mevcut kullanıcı/işletme/işlem kayıtlarına veri güncellemesi veya silme uygulanmadı. Yedek alındığı iddia edilmez.

**Henüz test edilmedi:** gerçek müşteri JWT'siyle Edge Function üzerinden başarılı puan gönderme/güncelleme, çok müşterili gerçek ortalama, yönetici oturumuyla açma/kapatma, Edge dağıtım sonrası HTTP invocation, Expo/TypeScript build, iOS/Android ve Keşfet regresyon testleri. Eski deneyim yazımındaki önceki HTTP 500'ün çözüldüğü iddia edilmez; deneyim alanı talep doğrultusunda kapatılmıştır. Kullanıma açmadan önce o akış ayrıca gerçek oturumla doğrulanmalıdır.

Dosyalar: `supabase/migrations/20261020_independent_stars.sql`, `supabase/tests/independent_stars_read_only.sql`, `supabase/functions/rating-api/index.ts`, `services/ratingService.ts`, `services/discoveryRatingService.ts`, `contexts/RatingContext.tsx`, `hooks/useRatings.ts`, `hooks/useBusinessRating.ts`, `hooks/useExperienceApproval.ts`, `BusinessStarRating`, `ExperienceAccessCard`, `ExperienceApprovalControl` ve ilgili profil/Keşfet/yönetici ekranları.


## Uygulanan kapsam

- Mevcut OnSpace Cloud, kullanıcı/işletme kimlik doğrulaması ve ana yönetici korunmuştur. Yönetici e-postası, mevcut rol sistemi ve `admin-api` kimlik doğrulama akışı değiştirilmemiştir.
- Gerçek işletmelerin profilinde kompakt müşteri deneyimleri kartı: başlık, genel puan, değerlendirme sayısı ve yorumlara bağlantı. Ayrı deneyim ekranında küçük özet ve yalnızca yeterli verisi olan öne çıkan satırlar gösterilir; boş üç büyük kart kaldırıldı.
- Müşteri–işletme başına benzersiz değerlendirme. Fiyat, hijyen, personel, hizmet kalitesi, ortam ve ürün çeşitliliği için ayrı 1–5 yıldız seçilir. Altı puan ve isteğe bağlı yorum tek RPC/transaction ile gönderilir. Genel puan özelliklerin bir ondalığa yuvarlanmış ortalamasıdır; bir müşteri tek değerlendirme sayılır. Kendi yorumunu düzenleme/kaldırma, 20'li sayfalama ve gerçek ortalamaya göre sıralama korunur. Eksik/geçersiz puanlar sunucuda reddedilir; çift gönderim istemcide kilitlenir.
- Yeni değerlendirmeler ve normal güncellemeler doğrudan `published` olur; yorumlar herkese açıktır. Yönetici tarafından `hidden` yapılan yorum güncellenirse `pending` olur, böylece gizleme denetimi aşılamaz. Önceden bekleyen veya gizlenen kayıtlar topluca yayımlanmadı. Yalnızca `published` değerlendirmeler ortalamaya katılır. `criteria_ratings` sütunu eklenmiştir; eski kayıtların boş özellik nesnesi eski genel puanına geri döner. `businesses.rating/review_count` değerleri değiştirilmedi; uygulama sunucunun `feedback_ratings` sonucunu kullanır.
- İşletme sahibi yalnızca kendi işletmesinin yayımlanmış yorum/önerilerine cevap verebilir. Yeni yorum cevapları doğrudan yorumun altında yayımlanır; yönetici tarafından gizlenen cevap güncellemeleri yeniden incelenir. Öneri cevapları önceki inceleme akışında kalır. İşletme hesapları ve işletme sahibi eski müşteri hesapları müşteri değerlendirmesi oluşturamaz; sahiplik ve rol sunucuda denetlenir. Yorum güncellemeleri mevcut işletme cevabını silmez.
- İstenen 7 işletme şikâyet kategorisi; yorum/öneri/işletme cevabı için uygunsuz içerik, spam ve kişisel bilgi bildirimleri.
- Şikâyet açıklamaları ve kimlikler public RPC'de yer almaz. Kanıt fotoğrafları özel, 5 MB sınırına sahip Storage alanına yüklenir. Yönetici görüntüleme bağlantıları 60 saniyeliktir, görüntüleyici disk önbelleği kullanmaz.
- Öneriler işletme + standart konu bazında birleştirilir. Tek kullanıcı aynı öneriye bir aktif destek verebilir veya desteğini geri çekebilir. Destek sayısı ve sıralama sunucuda hesaplanır.
- En beğenilen özellik: ilgili özelliğe 4–5 yıldız veren yayımlanmış değerlendirmelerden en az 3 farklı müşteri; eski tek-konulu değerlendirmeler geriye uyumlu olarak dahil edilir. En çok bildirilen konu: açık/incelenen/sonuçlanan bildirimlerde konu başına en az 3 farklı aktif bildiren. En çok talep: yayımlanmış önerilerde en az 3 farklı aktif destekleyen. Bu üç hesap birbirinden ayrıdır. Şikâyetler doğrulanmış bulgu olarak sunulmaz.
- Yeni yönetici ekranında yorumlar, şikâyetler, öneriler, işletme özeti ve yarım kalan hesap silme işlemleri yer alır. Yayımlama/gizleme/durum değişiklikleri en az 5 karakterlik gerekçeyle, `admin_logs` kaydıyla aynı transaction içinde uygulanır.
- Eski `/admin/complaints` bağlantısı korunur ve yeni gerekçeli şikâyet ekranına yönlenir.
- Ortak FeedbackProvider değişiklikleri ekranlar arasında paylaşır. Aktif uygulamada 30 saniyelik polling ve öne gelişte yenileme kullanılır; Realtime kullanılmaz.

## Güvenlik ve veri bütünlüğü

Yeni tablolar: `business_reviews`, `business_suggestions`, `suggestion_supports`. Bunlara ek olarak yalnızca iki teknik tablo oluşturuldu: transaction-kilitli hız sayaçları için `feedback_rate_limits`, yarım kalan kalıcı hesap silmelerini takip etmek için `account_deletion_requests`.

Mevcut `complaints` tablosuna yalnızca `feedback_category`, `evidence_path`, `resolution_note`, `updated_at` eklendi. Mevcut satırlar silinmedi, şikâyet ve onay durumları sıfırlanmadı. Yeni tabloların tamamında RLS açıktır. Anonim/oturumlu istemcilerin yeni tablolara doğrudan yazma yetkisi yoktur; `feedback_write` doğrulanmış işlem yoludur.

Sunucu, doğrulanmış e-postayı, aktif hesabı, kısıtlama süresini ve işletme sahipliğini denetler. Kabul edilmiş yazma işlemlerinde saatlik 30 işlem, 10 saniyede 1 yazma, günlük 3 şikâyet ve 7 gün içinde aynı kullanıcı/hedef/kategori tekrarı sınırları vardır. Limit satırları transaction kilidiyle korunur. Yeni şikâyetlerde doğrudan tablo INSERT'i de aynı doğrulama tetikleyicisinden geçer.

Sahte hesapları tamamen engelleme garantisi yoktur. Benzersiz değerlendirme/destek, doğrulanmış e-posta, moderasyon ve hız sınırları kötüye kullanımı azaltır; koordineli gerçek kişi/sahte hesap saldırıları için operasyonel inceleme hâlâ gerekir. Başarısız/geri alınmış transaction'lar hız sayaçlarını artırmaz; ağ seviyesindeki kötü niyetli trafik ayrıca platform katmanında kontrol edilmelidir.

Tüm security-definer fonksiyonların search_path'i sabittir; anonim public erişim yalnızca kişisel alanları içermeyen okuma projeksiyonlarına verilir. Silme/temizleme RPC'leri yalnızca service_role tarafından çalıştırılır. Service rolü istemciye taşınmamıştır.

## Hesap silme politikasının gerçek kapsamı

Kullanıcı Profil → Ayarlar → Hesabımı Sil üzerinden mevcut şifre + `HESABIMI SİL` + son onayla kendi hesabını silebilir. Ana yönetici bu akış dışında tutulur. Son onay verilmeden mevcut hesaplarda veri değişikliği gerçekleşmez.

1. Sunucuda şifre yeniden doğrulanır. Hedef id istemciden alınmaz; oturumdan türetilir.
2. İşlem isteği kilitlenir. Aynı anda ikinci silme başlamaz. Hatalı işlem yeniden devam ettirilebilir; işlemde görünen istekler en az 15 dakika sonra devam ettirilebilir.
3. Kullanıcının özel şikâyet kanıt dosyaları kaldırılır.
4. Kişisel profil alanları, kendi müşteri sipariş/rezervasyon iletişim alanları ve sipariş notları temizlenir. Kendi yorumları görünürlükten çıkarılır ve metinleri temizlenir; destekleri pasifleştirilir; şikâyet açıklamaları temizlenir. Kendi işletme cevapları kaldırılır.
5. Sahip olunan işletmeler yayından kaldırılır; telefon/e-posta temizlenir. İşletme, reklam, ödeme ve onay kayıtları korunur.
6. Auth `deleteUser(id, true)` ile **soft deletion** kullanılır. Hard delete/FK cascade kullanılmaz. Metadata-sync tetikleyicisi sonrasında kişisel alanlar tekrar aynı idempotent temizlemeden geçer.
7. İstek ancak tüm adımlar başarılıysa completed olur. Hata olduğunda failed görünür; yönetici yalnızca daha önce sahibi tarafından doğrulanmış isteği devam ettirebilir.
8. Cihaz oturumu ve yerel kayıtlar temizlenir.

Teknik id/ilişkiler korunur. Bu nedenle uygulanan işlem, giriş hesabının kalıcı kapanması ve bilinen kişisel alanların temizlenmesidir; bütün geçmişin geri döndürülemez anonimleştirildiği iddiası değildir. İşletme adı/adresi/medyası, kuponlar, işlem kalemleri ve hukuken gerekli tarih/tutar/durum kayıtları korunabilir. Önceki serbest metinler ve üçüncü taraf kayıtları için daha geniş bir hukuki/operasyonel veri envanteri gerekebilir. Saklama süresi henüz kullanıcı tarafından belirlenmediği için otomatik toplu veri imhası veya süreli silme görevi eklenmemiştir.

Aktif ya da eski JWT ile silinmiş hesabın tablo yazımlarını sürdürmesini önlemek için yeni kapalı-hesap tetikleyicileri eklendi. `user_profiles` ve `businesses` için istemciden doğrudan DELETE, ilişkili işlem kayıtlarını cascade ile yok etmemesi için engellenir. Hesap silme yalnızca güvenli akışta gerçekleşir. Hiçbir mevcut yönetici hesabı silinmedi/kısıtlanmadı veya rolü değiştirilmedi.

## Gerçekten gerçekleştirilen kontroller

- Salt okunur başlangıç ve son karşılaştırması: **4 profil, 11 işletme, 2 şikâyet, 1 yönetici** korundu. Yeni değerlendirme/öneri/silme isteği sayıları sıfırdır; gerçek hesap üzerinde silme veya moderasyon testi yapılmadı.
- Yeni 5 tabloda RLS etkinliği kontrol edildi.
- Anonim rolün yazma RPC'si yetkisi olmadığı; authenticated rolün doğrudan review INSERT ve hesap temizleme RPC'si yetkisi olmadığı doğrulandı.
- Benzersiz değerlendirme ve destek kısıtları, yeni şikâyet guard'ı ve kapalı-hesap guard'ı katalogdan doğrulandı.
- Kimliksiz actor/admin çağrısı ve erişilemez işletmenin public okuması 42501 ile reddedildi. Bu testler gerçek kullanıcı verisi değiştirmeyen okuma yardımcılarını kullandı.
- SQL fixture hesaplaması: 5,3,4 → ortalama 4; 3 değerlendirme; tekrar eden 1,1,2,3 destekleri → 3 farklı kişi; 2 kişinin 3 kişilik eşiğin altında olması doğrulandı.
- Kontrol anında PostgreSQL hata kayıtlarında hata görülmedi. Bu, cihaz veya uçtan uca test yapıldığı anlamına gelmez.
- Test/yeniden kontrol sorguları `supabase/tests/feedback_read_only_checks.sql` dosyasındadır.

**Doğrulanmamış:** Bu oturumda Expo/TypeScript build komutu, iOS/Android cihaz testi, gerçek müşteri/işletme/yönetici oturumlarıyla uçtan uca RPC testi, Storage yükleme testi veya `feedback-api` dağıtımı sonrası invocation testi çalıştırılmadı. Bunlar tamamlandı olarak raporlanmaz. Veritabanı yedeği alındığı iddia edilmez; mevcut verileri temizleyen migration veya gerçek hesap silme işlemi uygulanmadı.

## Zorunlu kabul testi senaryoları

Gerçek üretim hesaplarını test verisi olarak silmeyin. Ayrı kontrollü test hesaplarıyla:

| Senaryo | Beklenen sonuç | Durum |
|---|---|---|
| Mevcut kullanıcı/işletme/ana yönetici giriş ve OTP kayıt | Mevcut akışlar çalışır, rol değişmez | Cihazda bekliyor |
| Müşteri altı özellik puanı ve yorum gönderir/günceller | Tek kayıt; doğrudan yayında; gizlenen yorum güncellemesi pending; ortalama/sayı güncellenir | SQL hesap ve sözleşme doğrulandı; gerçek JWT/cihaz bekliyor |
| 0/6 puan veya başka kullanıcı adına doğrudan yazma | Reddedilir, veri değişmez | Rol izinleri doğrulandı; gerçek JWT bekliyor |
| Kullanıcı kendi yorumunu siler | Yorum ve puan public ortalamadan çıkar | Test hesabıyla bekliyor |
| İşletme başka işletmeye cevap yazar / puan verir | Sunucuda reddedilir | Gerçek JWT bekliyor |
| İşletme kendi işletmesinin yorumuna cevap verir | Doğrudan yorum altında görünür; gizlenen cevap güncellemesi yeniden incelenir | SQL sözleşme doğrulandı; gerçek JWT/cihaz bekliyor |
| Anonim/normal kullanıcı moderasyon | 42501/403; kayıt değişmez | Kimliksiz okuma denetimi doğrulandı; normal JWT bekliyor |
| Aynı öneriye tekrar destek/geri çekme | Tek benzersiz destek, gerçek sayı/sıra | Constraint doğrulandı; uçtan uca bekliyor |
| Aynı şikâyeti 7 günde tekrar / günlük dördüncü | Sunucuda reddedilir | Bekliyor |
| Şikâyet kimlik/kanıt public sorgusu | Public projeksiyonda kişisel alan yok; özel kanıt yetkisiz erişilemez | RLS/izin doğrulandı; Storage bekliyor |
| Admin şikâyet sonucu/gizleme | Gerekçe + tarih/işlem türü logu aynı transaction | Bekliyor |
| 2 vs 3 farklı katılımcı ve eşit destek | Eşik doğru, sıralama deterministik, şikâyet iddia olarak gösterilir | SQL fixture doğrulandı; çok hesap bekliyor |
| Test hesabı silme, aynı anda iki istek, hata/tekrar | Profil/işlem kişisel alanları temizlenir; işlem satırları korunur; job tamamlanır veya failed | Yıkıcı test yapılmadı |
| Yönetici hesabını silme | Hem UI hem sunucuda reddedilir | Kod/rol denetimi; gerçek JWT bekliyor |
| Sipariş/minimum tutar/randevu/menu/reklam/onay akışları | Eski çalışan özellikler korunur | Regression cihaz testi bekliyor |
| 320px, tablet ve yatay görünüm, klavye | Ekranlar kayar; eylemler ve geri dönüş erişilebilir | Cihaz testi bekliyor |

## Değişen/eklenen dosyalar

- `app/_layout.tsx`, `app/index.tsx`
- `app/(tabs)/profile.tsx`
- `app/business/[id].tsx`, `app/business/manage/[id].tsx`, `app/business/feedback/[id].tsx`
- `app/account-delete.tsx`
- `app/admin/_layout.tsx`, `app/admin/index.tsx`, `app/admin/complaints.tsx`, `app/admin/feedback.tsx`
- `contexts/AppContext.tsx`, `contexts/FeedbackContext.tsx`
- `hooks/useFeedback.ts`, `hooks/useBusinessFeedback.ts`, `hooks/useFeedbackReply.ts`, `hooks/useFeedbackAdmin.ts`, `hooks/useAccountDeletion.ts`
- `services/feedbackService.ts`, `services/businessService.ts`
- `constants/feedbackStyles.ts`
- `components/feature/FeedbackControls.tsx`, `BusinessFeedbackSummary.tsx`, `FeedbackReply.tsx`, `FeedbackForm.tsx`
- `supabase/functions/feedback-api/index.ts`
- `supabase/tests/feedback_read_only_checks.sql`, bu rapor

## 20 Ekim 2026 özellik puanları güncellemesi

Migration: `supabase/migrations/20261020_feedback_criteria.sql`. Yalnızca ek sütun/kısıt ve fonksiyon tanımları uygulandı; mevcut müşteri kayıtları üzerinde UPDATE/DELETE veya toplu yayımlama yapılmadı. Fonksiyon değişiklikleri bilinen kuralları kontrol ederek transaction içinde uygulanır. Mevcut rol, işletme sahipliği, hız sınırları, şikâyet gizliliği, moderasyon ve hesap silme akışları korunur.

Salt okunur testler başarılı: altı geçerli puan, eksik/bilinmeyen özellik, 0/6/kesirli/metin/null/dizi reddi, 4.0 ve 4.2 ortalamalar, eski puan geri dönüşü, üç public sıralama sorgusu, anonim yorum/cevap yazımının reddi, RLS ve doğrudan yazma yasağı. Kontrol sırasında 4 profil, 11 işletme ve 0 değerlendirme korunmuştur; PostgreSQL hata kaydı görülmedi. Tekrar çalıştırılabilir kontroller `supabase/tests/feedback_criteria_checks.sql` dosyasındadır. Cihaz/build ve gerçek oturumlu gönderme-cevaplama testleri bu oturumda çalıştırılmadı.

Ek/değişen UI: `FeedbackCriteria.tsx`, `FeedbackControls.tsx`, `FeedbackForm.tsx`, `FeedbackReply.tsx`, `BusinessFeedbackSummary.tsx`, deneyim ve yönetici ekranları. `useBusinessFeedback` bağımsız puan taslağını ve tek gönderim kilidini yönetir; `useFeedbackReply` cevap gönderim kilidini ve sonucu yönetir. Ortak FeedbackProvider değişiklikten sonra bütün deneyim ekranlarını yeniler.

## Güvenli geri çekme

Özellikleri geri çekmek gerekirse önce yeni ekran bağlantılarını/FeedbackProvider'ı kaldırın ve yeni RPC execute izinlerini kapatın. Tablo DROP, kayıt DELETE, mevcut rol değiştirme veya toplu puan sıfırlama kullanmayın. Yeni veriler oluştuğunda şema/tetikleyici geri alma ancak yedek ve ayrı onayla planlanmalıdır. Yedek, saklama süresi ve hukuki gereklilikler netleşmeden korunan işlem kayıtlarına toplu imha uygulanmamalıdır.

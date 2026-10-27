# Teslim edilen siparişten sonra değerlendirme baloncuğu

- Aktif müşteri, sipariş teslim edildikten sonraki uygulama açılışında işletmeyi doğrudan üstteki baloncuktan puanlayabilir.
- Soğuk açılış ve uygulamanın gerçekten arka plandan geri dönmesi yeni açılıştır. İzin pencereleri gibi geçici `inactive` durumları yeni açılış sayılmaz.
- Açılışın sabit zamanından sonra gerçekleşen teslimatlar aynı kullanım sırasında değerlendirme istemez. Sonraki açılışı bekler. Keşfet/Gönderiler akışları değiştirilmez veya otomatik yenilenmez.
- `order_messages` içindeki sunucu teslim zamanı kullanılır; oluşturulma tarihi teslim zamanı gibi değerlendirilmez. Önceki sürümden teslim olayı olmayan eski siparişler için sahte teslim zamanı oluşturulmaz.
- Yalnızca kullanıcıya ait, gerçekten teslim edilmiş ve işletmesi yayındaki siparişler görünür. Kullanıcı işletmenin sahibi olamaz. İşletme/yönetici hesaplarında gösterilmez. Mevcut uygulama içi bildirim tercihi korunur.
- Baloncukta 0,5–5 arasında yarım yıldız seçimi ve `Puanımı gönder` vardır; başka bir sayfaya geçmeden gönderilir.
- `Daha sonra` yalnızca bu açılış için erteler. Sonraki açılışta tamamlanmamış değerlendirme yeniden uygun olabilir. Başarılı gönderimde kalıcı özel sipariş makbuzu tutulur.
- Puanlar mevcut `business_star_ratings` tablosunda her müşteri/işletme için tek oy olarak tutulur; tekrar siparişler ikinci oy oluşturmaz, mevcut puanı günceller. Teslimattan sonra profil üzerinden verilmiş puan için tekrar hatırlatma çıkmaz.
- `rating-api` JWT ve doğrulanmış e-postayı kontrol eder. İşletme kimliğini istemci değil, sunucu siparişten çözer. `submit_order_business_rating` mevcut yıldız puanlama kontrollerini kullanır; oy, makbuz ve teslim bildirimi okundu işlemi tek transaction içinde gerçekleşir.
- Başarısız gönderimde seçim korunur, hata baloncukta görünür ve tekrar denenebilir. Başarılı gönderimde baloncuk içinde onay gösterilir. Oy kaydından önce bildirim okundu sayılmaz.
- Değerlendirme ve sipariş durum baloncukları üst üste binmez; değerlendirme baloncuğu görünürken diğer sipariş bildirimleri bekler.

## Kontroller

`supabase/tests/order_rating_prompts_read_only.sql` izin, RLS ve RPC kontrolleridir; `tests/orderRatingPromptChecks.ts` açılış filtresi, erteleme ve yarım yıldız doğrulaması içerir. Gerçek cihazda teslim sırasında açık uygulama, sonraki soğuk açılış, arka plandan dönüş, iptal/erteleme, başarılı gönderim, bağlantı kesilmesi, yinelenen gönderim ve hesap değişimi ayrı ayrı denenmelidir.

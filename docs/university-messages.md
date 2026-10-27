# Üniversiteden: yönetici onaylı LED yazı bandı

## Yerleşim ve görünüm
- Keşfet ekranında arama çubuğunun üstündeki sabit konumundan eski içerik alanına taşındı: Güncel Kampanyalar bandının altında, Yeme İçme/Eğlence ve Güzellik/Bakım kategorilerinin üstünde yer alır; listeyle birlikte kaydırılır.
- Güncel Kampanyalar ve Üniversiteden aynı `NeonTicker` görünümünü ve hareket altyapısını kullanır. Üniversiteden yazıları kendi ücretsiz müşteri/yönetici onayı akışını korur; ücretli işletme kampanyalarıyla karışmaz.
- Referans görsel `assets/images/university-reference.png` olarak korunur; dekoratif ışıklar gradyan ve noktalı LED çizgileriyle, başlık ve kullanıcı yazıları erişilebilir React Native Text bileşenleriyle çizilir.
- Eski neon pembe, turkuaz, altın ve menekşe görünüm korunur. Üstte 32 px Üniversiteden başlığı; altında 48 px kayan yazı satırı bulunur (toplam 80 px, dış boşluklar hariç). Başlıktaki taç/okul işaretleri korunur; Caddeden ayraçlarındaki taç kaldırılmıştır. Duraklat/oynat başlığın solunda, kendi yazını paylaşma düğmesi sağındadır; kayan yazı satırı bu düğmelerden arındırılmıştır.
- İki özdeş ölçülmüş içerik döngüsü 48 piksel/saniye hızında yalnızca sola kayar. Döngü sınırında özdeş kopyaya geçiş olduğundan boşluk veya sağa geri kayma oluşmaz.
- Arka planda ve başka ekranda animasyon durur. Duraklat/oynat düğmesi ve sistemin hareket azaltma tercihi desteklenir; hareket azaltmada metinler elle kaydırılabilen bir satırda da gösterilir.

## Kullanıcı akışı
1. Bant üzerindeki Yazı gönder düğmesi `/university` sayfasını açar.
2. Yalnızca aktif müşteri (`role=user`) hesabı 4–160 karakterlik yazı gönderebilir.
3. İstek `pending` olarak saklanır; aynı işlemde yönetici için başvuru bildirimi oluşturulur.
4. Kullanıcı kendi isteklerini ve karar notlarını listeler; aşağı çekerek yenileyebilir.
5. Hiç onaylı yazı yoksa bant bir katılım çağrısı gösterir. Demo kullanıcı yazıları veya otomatik onay yoktur.

## Yönetici akışı
- Yönetici Paneli → Üniversiteden Yazı Onayları (`/admin/university`).
- Bekleyen / Yayında / Yayınlanmadı filtreleri.
- Onayla ve yayınla; not ile reddet; mevcut yazıyı yayından kaldır; reddedilmiş yazıyı tekrar onayla.
- Başvuru sayısı yönetici panelindeki bağlantıda görünür.
- Mevcut `admin-api` JWT ve yönetici kontrolleri korunur. Moderasyon RPC'si ayrıca yetkili yöneticiyi doğrular, satırı kilitler, beklenen durumu kontrol eder ve karar ile denetim kaydını tek işlemde yazar.

## Veri ve güvenlik
- Yeni tablo: `university_messages`. İki kullanıcı ilişkisi de `public.user_profiles` üzerindedir; mevcut hesaplar ve işletmeler değiştirilmez.
- RLS: müşteri yalnızca kendi taleplerini okuyabilir. İstemcilere doğrudan insert/update/delete ve moderasyon yetkisi verilmez.
- `submit_university_message`: sunucunun `account_customer()` kontrolü, boşluk normalizasyonu, 160 karakter sınırı, 60 saniye gönderim aralığı ve en fazla 3 bekleyen talep. Aynı kullanıcı için eşzamanlı istekler danışma kilidiyle sıraya alınır.
- `university_public_messages`: yalnızca onaylı ve aktif/doğrulanmış müşterilere ait yazıları id/text/published_at olarak sunar. Kullanıcı kimliği, e-posta ve moderasyon notu halka açılmaz.
- Hesap silme isteği bulunan veya kısıtlı hesapların yazıları halka açık projeksiyondan çıkar. Profil silinirse sahiplik foreign key'i yazıları cascade ile temizler.
- Paylaşılan UniversityProvider moderasyon ve gönderim sonrasında durumu yeniler. Diğer cihazlar 30 saniyelik yoklama, odaklanma ve uygulamaya geri dönme üzerinden güncellenir; Realtime kullanılmaz.

## Doğrulama
- Canlı veritabanında RLS, ham veri erişimi, doğrudan yazma ve moderasyon izinleri; anonim halka açık projeksiyon; mevcut yetkili yönetici; oturumsuz/işletme/yönetici yazı gönderiminin reddedilmesi doğrulandı.
- Mevcut bildirim ve denetim tablolarında yeni tipleri engelleyen check constraint bulunmadığı doğrulandı.
- Testler mevcut kullanıcı kayıtları oluşturmadan veya değiştirmeden çalıştırıldı.
- Cihaz/build ve başarılı gönderim → yönetici onayı → başka cihazda görünüm uçtan uca testleri bu oturumda çalıştırılmadı.

## Manuel cihaz kontrolü
1. Kullanıcı ile kısa yazı gönder; onaylanmadan halka açık bantta görünmediğini doğrula.
2. Yönetici ile onayla; kullanıcı sayfasında onay durumunu ve bantta yazıyı gör.
3. En az bir uzun ve birkaç kısa yazıyla tam döngüyü izle; sınırda atlama/boşluk olmadığını kontrol et.
4. Duraklat/oynat, yatay ekran, 320 px genişlik, hareket azaltma ve arka plana geçişi kontrol et.
5. Yazıyı yayından kaldır; diğer cihazda bir sonraki yenilemede çıktığını doğrula.
6. İşletme hesabıyla gönderimin engellendiğini ve mevcut işletme/yönetici yetkilerinin değişmediğini doğrula.

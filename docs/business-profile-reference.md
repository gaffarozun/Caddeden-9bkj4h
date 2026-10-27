# İşletme profili ve menü tasarımı

## Tasarım
Caddeden müşterileri işletmenin görünümünü, konumunu ve fiyatlarını tek bakışta inceleyip güvenle sipariş veya rezervasyon talebi oluşturur. Görsel dil: pürüzsüz ve katmanlı sahne; koyu temada sıcak altın, açık temada sıcak bej, pembe temada referans pembe/rose vurguları; solda ürün fotoğrafı, sağda fiyat. Aynı malzeme ve kontrol biçimleri artık Keşfet, gönderiler, profil, sipariş/rezervasyon ve işletme/yönetici panellerinde kullanılır.

Görsel referans arayüz olarak kullanılır, uygulamada ekran görüntüsü gösterilmez. Dokunulabilir ve erişilebilir React Native bileşenleriyle uygulanmıştır. Mobil ölçüler `constants/theme.ts` içindeki `businessProfileLayout` üzerinden, ortak stiller `constants/businessProfileStyles.ts` üzerinden yönetilir. Ekran genişlikleri ve işletmenin metin uzunluğuna göre düzen uyarlanır; bütün cihazlarda piksel eşitliği iddia edilmez.

## Sayfalar
- `/business/[id]`: kapak, logo, işletme adı (onay rozeti olmadan), bağımsız yıldız ortalaması, kategori, uzaklık ve açık/kapalı durumu; Ara/Konum/Kaydet/Paylaş; Menü & Fiyatlar ve ayrı rezervasyon bağlantısı.
- `/business/menu/[id]`: işletmenin oluşturduğu kategori başlıkları, ortak veya kategoriye özel üst fotoğrafı, solda fotoğraf ve ürün açıklaması, sağda fiyat. Siparişe açık işletmelerde fiyatın solunda küçük artı; seçilmiş ürün altında azaltma kontrolü.
- `/business/reserve/[id]`: tarih, saat, kişi/hizmet ve telefon ile mevcut gerçek rezervasyon tablosuna talep gönderimi.
- `/business/rate/[id]`: yorum listesi yerine mevcut bağımsız yarım yıldız puanlama. Müşteri deneyimleri yönetici anahtarı ve moderasyon sistemi değiştirilmedi.
- `/history?businessId=...&mode=active|past`: seçili işletmenin aktif veya tamamlanmış/reddedilmiş siparişleri. Rezervasyonlar ayrı seçilebilir. Ekran açıkken 15 saniyelik sorgulama ve elle yenileme ile durum takibi.

## Veri ve izinler
Mevcut `businesses.maps_url`, `menu_cover_url`, `menu_group_covers`, `profile_tags` alanları kullanılır. Yeni tablo oluşturulmadı ve mevcut kullanıcı/sipariş verileri değiştirilmedi. İşletme sahibi düzenlemeleri mevcut RLS ile yetkilendirilir. Kapak/kategori fotoğrafları `business-media` altında saklanır; yalnızca URL'ler profil kaydında tutulur. Bu değişikliklerde yönetici onayı gerekmez; işletmenin yayın onayı, kampanya onayı ve korunan profil alanları korunur.

İşletme Sayfam ekranındaki Profil ve menü görünümü alanından Google Haritalar bağlantısı, etiketler, üst menü fotoğrafı ve kategori kapakları düzenlenebilir. Fotoğraf seçimi zorunlu kırpma yapmaz. Kategoriler ürün eklerken Grup / Başlık ile oluşturulur ve topluca yeniden adlandırılabilir. Ürün eklerken kısa açıklama/ürün içeriği girilebilir.

Ara, numarayı onay kutusunda gösterir ve `tel:` ile telefon uygulamasına geçer. Konum, kaydedilmiş Google Haritalar bağlantısını, yoksa koordinat/adres aramasını açar. Paylaş, işletmenin uygulama içi bağlantısını ve Haritalar bağlantısını sistem paylaşım akışına verir. Keşfet kampanyaları fotoğrafsız, kompakt metin kartlarıdır.

## Sipariş akışı
Sepet `BusinessCartProvider` ile sayfalar arasında paylaşılır, hesap değişince temizlenir; henüz uygulama kapanışına karşı kalıcı saklama uygulanmaz. Telefon/adres/konum profilden doldurulur. Sipariş öncesinde güncel ürünlerin varlığı, fiyatı, minimum tutar, sahiplik ve açık/kapalı durumu istemcide tekrar kontrol edilir. Mevcut konum ile teslimat konumu arasındaki izin verilen mesafe 1 km (1000 m) olarak uygulanır; 1 km üzerindeki mesafelerde sipariş engellenir. Talep mevcut `orders` tablosuna aynı servis üzerinden yazılır ve Aktif siparişler sayfası açılır. Bu sürüm mevcut RLS'yi değiştirmez; istemci fiyat denetimi sunucu taraflı fiyat doğrulamasının yerine geçmez.

## Hesaba özel görünüm
`ThemeProvider`, `AuthProvider` içinde çalışır ve mevcut `authUser.gender` değerini kullanır. Varsayılan (`auto`) kadın için toz pembe, erkek için koyudur; cinsiyet belirtilmemiş/misafir hesap koyu açılır. Manuel açık/koyu/pembe seçimi cinsiyetten bağımsızdır. Cihaz teması seçeneği işletim sistemini takip eder. Profil → Ayarlar → Görünüm bölümünde üç tema önizlemesi, Varsayılan ve Cihaz teması seçenekleri vardır.

Tercihler AsyncStorage üzerinde `caddeden-appearance-v2:<hesap-id>` anahtarıyla bu cihazda saklanır; misafir tercihi ayrıdır. Hesap değişimi eski hesabın temasını yeni hesaba taşımaz. Eski, hesapla ilişkilendirilmemiş cihaz tercihi yalnızca misafir için okunur. Yeniden giriş manuel seçimi sıfırlamaz. Profilde cinsiyet güncellendiğinde yalnızca Varsayılan modu buna uyar. Veri tabanına yeni alan eklenmez, mevcut cinsiyet/kimlik verisi değiştirilmez; cihazlar arası tema eşitlemesi yoktur.

Aktif palet `useTheme`, `useThemeStyles` ve `useBusinessTheme` üzerinden okunur. İşletme profili/menü/ödeme formu artık sabit koyu palet kullanmaz. `onPrimary` renk tokenı altın butonların yazılarını koyu, açık/pembe butonların yazılarını açık tutar. Referans pembesi `pinkColors.brand` alanında bulunur; küçük metinlerde daha koyu rose rengi kullanılır. Navigasyon ve durum çubuğu palete uyar. Görünüm yüklenirken navigasyon sökülmeden geçici yükleme katmanı gösterilir.

Ek görünüm kontrolleri (henüz çalıştırılmadı):
- Yeni kadın hesabında Varsayılan/pembe, erkek hesabında Varsayılan/koyu açılış.
- Her hesabın üç paleti seçebilmesi; işletme ve yönetici alt ekranlarının da değişmesi.
- Kadın hesabında koyu seçip çıkış/yeniden giriş sonrası koyunun korunması; aynı cihazda farklı hesaba geçince tercihin taşınmaması.
- Varsayılan moddayken cinsiyet güncellemesi; manuel moddayken değişmemesi.
- Cihaz teması modunda OS açık/koyu değişimi; manuel pembe modunun OS tarafından değiştirilmemesi.
- Depolama erişimi reddinde görünür hata ve oturum içi tema değişiminin çalışması.
- Profil, menü, sepet, rezervasyon, puanlama, filtreler ve tüm panellerde üç paletin metin/arka plan okunabilirliği.

## Doğrulama sınırı ve cihaz kontrol listesi
Derleme/gerçek cihaz testi bu oturumda çalıştırılmadı. Yayınlamadan önce:
1. 320–414 px telefon, tablet ve yatay yönlerde profil/menü boyutlarını inceleyin.
2. İşletme hesabıyla ortak ve kategoriye özel kapak ekleyin; müşteri hesabında yeniden açıp göründüğünü doğrulayın.
3. Kategori adı değiştirme, yeni ürün/grup ekleme ve açıklama kaydını kontrol edin.
4. Ara numara gösterimi ve telefon uygulaması, kaydedilmiş Haritalar bağlantısı, kaydet ve native paylaşım akışlarını cihazda test edin.
5. Siparişe kapalı işletmede artı/sepet görünmemesini; açık işletmede kategoriler arasında sepetin korunmasını doğrulayın.
6. Minimum altında gönderimin engellenmesini, telefon/konum eksikliğini, konum izni reddini, 1000 m sınırında kabulü ve 1000 m üzerindeki hata durumlarını test edin.
7. Gerçek müşteri talebini işletme hesabından onaylayıp teslim edildi olarak işaretleyin; müşterinin aktif/geçmiş listesine yansımasını kontrol edin.
8. Rezervasyon/randevu talebi ve işletme onayını kontrol edin.
9. Demo işletmelerde gerçek sipariş/rezervasyon/puan yazımı olmamasını ve işletme/yönetici hesaplarının puan verememesini doğrulayın.

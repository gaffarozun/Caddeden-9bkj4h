# Caddeden açılışı

- Karanlık gökyüzü altında, sokak lambaları ve kafe ışıklarıyla aydınlanan yokuş aşağı bir cadde; ortada palmiyeli refüj, bir tarafta aşağı gidiş ve diğer tarafta dönüş yolu.
- Yerel `assets/images/caddeden-intro-night-street.webp` illüstrasyonu `expo-image` ile gösterilir. Sabit hızda ilerleme hissi veren kamera yaklaşması, yükselerek beliren Caddeden adı ve kısa kapanış geçişi vardır. Araçlar ve palmiyeler illüstrasyonun parçalarıdır; bağımsız hareket etmezler.
- Toplam süre 4.200 ms; kamera hareketi 3.700 ms, çıkış geçişi 280 ms. Fotoğraf yüklenmesi, tema tercihi veya ağ yanıtı bu süreyi uzatmaz.
- Animasyon kök navigatörün üzerinde çalışır. Oturum, roller, işletme onayı ve yönlendirmeler altta yüklenmeye devam eder; rotalar değiştirilmez.
- Sekme değişimi, giriş/çıkış ve uygulamayı arka plandan öne getirme tekrar oynatmaz. Yeni kök uygulama oturumunda yeniden gösterilir.
- Hareketi azalt erişilebilirlik ayarı açıksa sabit görsel ve başlık gösterilir; kamera ve giriş/çıkış hareketleri kullanılmaz.
- Çentik güvenli alanları, yatay ekran ve 960 px içerik sınırından bağımsız tam ekran açılış desteklenir. Animasyon bitince zamanlayıcılar ve dinleyiciler temizlenir.
- Uygulamanın Expo görünen adı Caddeden; yerel sistem başlangıç ekranındaki hardal arka planı korunur. Ardından gece caddesi ve açık renk durum çubuğu gösterilir; kişisel tema animasyon bitince devralır.

## Manuel kontrol

1. Soğuk açılış: gece caddesi, palmiyeli orta refüj, ayrı gidiş/dönüş yolları, sokak lambaları, kafeler ve Caddeden başlığını kontrol et; yaklaşık 4,2 saniyede normal ekran açılmalı.
2. Giriş yapmış kullanıcı, işletme ve onay bekleyen işletmede mevcut hedef ekran korunmalı.
3. Sekmeler arasında gez; arka plana alıp geri dön. Açılış tekrarlanmamalı.
4. Hareketi azalt açıkken sabit açılış gösterilmeli.
5. 320 px telefon, yatay telefon ve tablette başlık kesilmemeli, güvenli alanlar korunmalı.
6. Yavaş veya kapalı ağda açılış uzamamalı; mevcut oturum/tema yükleme durumu kendi normal akışında sürmeli.

Gerçek cihaz kontrolleri bu geliştirme turunda çalıştırılmadı.

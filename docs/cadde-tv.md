# Cadde TV

## Güncel sahne
- Arka plan kullanıcı tarafından sağlanan neon oda görselidir: `assets/images/cadde-tv-neon-room.png`. Yerel görsel kullanılır; Unsplash veya uzaktan görsel yüklenmesine bağımlılık yoktur. Görselin özgün renkleri korunur.
- Sahne, kaynak görselin 941 × 1672 oranını korur. Oda ve TV birlikte %34 yakınlaştırılır; cam alanı sahne genişliğinin yaklaşık %94’ünü kaplar. Dış oda/kasa kenarları kırpılır, canlı camın tamamı görünür kalır. TV kasası arka planla aynı konum ve ölçekte yerleştirilir; ikinci bir TV veya farklı oda katmanı oluşmaz. Cam alanı (137, 432, 660, 376), canlı LED alanı (137, 808, 660, 63) kaynak piksel koordinatlarına göre hesaplanır. Fotoğraf ile altyazı aynı genişlikte, arada boşluk olmadan tek yuvarlatılmış cam yüzeyde kırpılır. Referanstaki daha geniş örnek altyazı (56, 817, 848, 63) maskelenir; örnek yazılar görünmez. Yakınlaştırılmış sahnede canlı yazılar kenarlardan kesilmez; altyazı içindeki sağ yazma/yenileme simgesi kaldırılmıştır. İşletme ön izlemesi de aynı yeni kasayı kullanır.
- Pembe, camgöbeği, altın ve mor parlayan öğrenci yazıları, çok renkli ince ışık rayları ve LED noktaları korunur. Fotoğraftaki örnek reklamın ve örnek altyazının üzerine gerçek yayın/boş durum ve onaylı öğrenci yazıları yerleştirilir.
- Fiziksel kumanda arayüzü, beğenme, kaydetme, paylaşma ve işletme açıklaması Cadde TV ekranından kaldırıldı. Eski kayıtlı içerikler ve diğer Gönderiler özellikleri silinmedi.
- Ekran `overflow: hidden` ve `expo-image contentFit="contain"` ile sınırlandırılır. Yeni oda görselinin cam geometrisi mevcut gönderim oranını değiştirmez; eski ve yeni fotoğraflar esnetilmeden, gerektiğinde kenar boşluklarıyla gösterilir.

## Fotoğraf akışı
- İki veya daha fazla yayında yedi saniye sonra otomatik sonraki görsele geçilir. Son görselden sonra ilk görselle döngü devam eder.
- Her izleyicinin TV oturumu başında yayınlar istemcide Fisher–Yates ile karıştırılır; sunucunun tarih/sponsor sırası ekranda yayın sırası olarak kullanılmaz. Rastgele seçimler bağımsızdır; iki izleyicinin tesadüfen aynı sırayı görmesi mümkündür. Anonim izleyiciler de aynı mekanizmadan yararlanır. Sunucu sorgulaması mevcut sırayı korur, kaldırılan yayınları çıkarır ve yeni yayınları karışık sırayla ekler; hiçbir kayıt/yetki değiştirilmez.
- TV ekranına dokunmak veya sağ ok sonraki görsele anında geçer; sol ok oturumun karışık kuyruğundaki önceki görsele döner. Her manuel işlem yeni bir yedi saniyelik süre başlatır. Hızlı art arda dokunuşlarda güncel liste üzerinden seçim yapılır.
- Yatay kayma yerine yalnızca fotoğraf alanında 240 ms'lik retro TV kanal ayarlama efekti uygulanır: parazit ve yatay ışık çizgisi görünür, efekt bittiğinde doğrudan sıradaki fotoğraf açılır. Önceki fotoğraf katmanı çizilmez; her yeni görsel ayrı anahtarla monte edilerek önceki görselin yükleme sırasında tekrar görünmesi engellenir. Sıradaki görsel henüz yüklenmediyse parazit yüzeyi hazır olana kadar kalır; geç yüklenen eski görsellerin olayları dikkate alınmaz. TV kasası, oda ve altyazı yerinde kalır. Azaltılmış hareket tercihinde ve işletme ön izlemesinde efekt uygulanmaz.
- Geçişte boş ekranı azaltmak için sadece o anki, sonraki ve önceki görseller `expo-image` önbelleğine hazırlanır; tüm yayın kütüphanesi indirilmez. Ön yükleme hatası normal görsel yüklemesini engellemez.
- Başlıktaki 4/5 benzeri sıra sayacı, alttaki yönetici onayı açıklaması ve otomatik değişim açıklaması kaldırılmıştır. Sponsorlu yayın etiketi, kategori filtresi ve yenile düğmesi korunur.
- Sekme odağı kaybolunca veya uygulama arka plana gidince otomatik geçiş durur; odak/ön plan geri geldiğinde yeni süre başlar. Zamanlayıcılar ve abonelikler temizlenir.
- Sekme açıkken 10 saniyelik sunucu sorgulaması yapılır. Aynı liste gelirse otomatik geçiş zamanlayıcısı sıfırlanmaz. Üstteki yenile düğmesi her zaman görünür; yayın ve yazılar beklemeden yeniden yüklenebilir. Kategori filtreleri görünür yayın listesini değiştirir. Tek yayında önceki/sonraki oklar pasiftir.
- Görselin ait olduğu işletmenin adı doğrudan `/business/{businessId}` profilini açar. Profil erişimi o anda gösterilen yayınla eşleşir. Profil bağlantısı ve ileri/geri okları, sayfanın altına sabitlenmiş çok saydam bir yüzeydedir; oda arkadan görünür ve bağlantı kaydırma sırasında da erişilebilir kalır.

## Öğrenci yazıları
- Sadece mevcut yönetici onaylı yazılar LED kanalında gösterilir; Üniversiteden başlığı yoktur.
- İki aynı ölçülen döngü ile kesintisiz sola kayan renkli yazılar kullanılır. Azaltılmış hareket tercihinde metin elle yatay kaydırılabilir.
- Yazı akışına dokunmak metni duraklatır/devam ettirir; bu, fotoğrafların yedi saniyelik akışından bağımsızdır.
- Sayfanın altındaki görünür, en az 48 px yüksekliğinde “Yazını TV’ye gönder” düğmesi mevcut `/university` gönderim ekranını açar ve tek yazı gönderme girişidir. Altyazının sağındaki kalem/yenileme düğmesi kaldırılmıştır; metin tüm alanı kullanır. Hatalarda üstteki genel yenile düğmesi kullanılabilir. Yönetici onayı, kullanıcı kontrolü ve gönderim sınırları korunur; yalnızca TV sayfasındaki yardımcı açıklama kaldırılmıştır.

## İşletme gönderimi ve veri koruması
- Cadde TV paylaşımı ve sponsorlu TV reklamında açıklama/reklam metni alanı gösterilmez ve zorunlu değildir. Hizmet katmanı TV içeriklerinde yeni `caption`/`title` değerini `null` gönderir.
- Normal Gönderiler ve diğer reklam türlerinin açıklama/metin akışları değişmez. Eski TV açıklamaları veritabanından silinmez; TV görüntüsünde okunmaz/gösterilmez.
- Fotoğraf kırpıcıda aynı zorunlu TV oranı korunur; önerilen ölçü 1584 × 1008 px. Ön izleme aynı TV kasasını ve cam geometri hesabını kullanır.
- Paketler, ücret hesapları, yönetici onayı ve ödeme doğrulaması değişmedi. Mevcut `public_cadde_tv_channels()` ve öğrenci RPC'leri kullanılır; kayıt, hesap, RLS, veri veya yetki silinmez.

## Yayınlanmama hatası ve düzeltme
- Canlı şemada kesin neden doğrulandı: veritabanı saat dilimi `America/Bogota`, yayın tarihleri ise 21 Ekim idi. Türkiye’de 21 Ekim olmuşken veritabanı `current_date` hâlâ 20 Ekim döndürüyordu. Onaylı, ödenmiş, görselli ve yayınlanmış işletmeye ait bir kayıt bu nedenle başlangıç tarihi filtresinde eleniyordu.
- `public_cadde_tv_channels()` tarih karşılaştırmaları açıkça `Europe/Istanbul` gününü kullanacak şekilde düzeltildi. Gelecekteki yayınlar ve süresi biten yayınlar yine filtrelenir. Ücretli TV içerikleri için ödeme doğrulaması gerekir; ücretsiz eski içerikler yalnızca onayla yayınlanabilir.
- Yönetici API’si yeni TV yayın tarihlerini sunucuda Türkiye gününe göre hesaplar. Sponsorlu TV reklamının süresi cihazdan gelen sabit 30 gün yerine seçilmiş paketten alınır. Görselsiz TV reklamını yayınlama girişimi açık hata gösterir; eski kayıt otomatik değiştirilmez.
- Canlı salt okunur kontroller başarıyla geçti: daha önce eksik olan onaylı ve ödenmiş görsel anonim TV sorgusunda görünür hale geldi (toplam 3 yayın). İşletme yayını, onay, ücretli ödeme, gelecek/bitiş tarihleri, boş görsel filtresi, RLS ve öğrenci yazma izinleri kontrol edildi.
- Mevcut içerikler, ödeme kayıtları, tarih değerleri, kullanıcılar ve yönetici kararları değiştirilmedi; sadece güvenli okuma fonksiyonu ve yeni kararların tarih hesabı düzeltildi.

## Doğrulama sınırları
- Canlı şema salt okunur kontrol edildi: TV açıklama/reklam başlığı alanları nullable, mevcut ekleme tetikleyicileri onay/ücret durumunu yönetir.
- Çağrı noktaları kontrol edildi: TV görüntüsü ve işletme ön izlemesi yeni kasa geometrisini kullanır; otomatik akış eski beğeni/kayıt/paylaşım aksiyonlarına bağlı değildir.
- Bu oturumda native cihaz veya derleme testi çalıştırılmadı. Cihaz kontrol listesi: 320/375/414 px ve tablet/yatay yön; 7 saniye döngü; 240 ms TV paraziti ve hızlı görsel açılması; hızlı ileri/geri dokunuş; manuel geçişten sonra yeni süre; oturum bazlı karışık sıra; aynı yayınlar sorgulandığında sıranın ve sürenin korunması; ilk/son yayın sarmalama; sekme/arka plan temizliği; boş/tek yayın; doğru işletme profili; açıklamasız TV gönderimi; normal Gönderi açıklamasının korunması; LED ve azaltılmış hareket; altyazıda sağ düğme ve sıra sayacının olmaması.

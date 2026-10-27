# Turuncu ve hardal varsayılan tema

- Caddeden’in ortak varsayılan görünümü daha parlak altın-hardal arka plan, canlı sarı yüzeyler ve belirgin turuncu marka vurgularından oluşur. Bağlantı ve butonlarda okunaklı koyu turuncu, metinlerde koyu kahverengi korunur; tüm ortak tema kullanan ekranlar aynı paleti alır.
- `mustardColors` semantik renkleri `constants/theme.ts` içinde tanımlıdır. `mustard` açık bir tema seçeneğidir; `auto` artık cinsiyetten bağımsız olarak bu paleti seçer.
- Misafir, kadın, erkek, kullanıcı, işletme ve yönetici aynı varsayılan paleti kullanır. Hesap türleri, cinsiyet bilgisi ve erişim yetkileri değiştirilmez.
- Giriş/kayıt ekranı ve mevcut `useTheme` / `useThemeStyles` kullanan keşfet, profil, işletme ve yönetici ekranları ortak sağlayıcıdan bu paleti alır. Girişteki eski cinsiyete göre pembe/koyu tema açıklaması güncellenmiştir.
- Görünüm ayarlarında “Turuncu · Hardal” seçeneği ve iki sütunlu, dar ekranlarda saran ön izlemeler bulunur.
- Daha önce açıkça seçilmiş pembe/açık/koyu/cihaz teması tercihleri korunur. “Varsayılan” seçilerek yeni ortak palete dönülebilir. Tema tercihleri mevcut hesap bazlı cihaz depolamasında tutulur; veritabanı kayıtları değiştirilmez.
- Cadde TV’nin kullanıcı tarafından sağlanan neon oda görseli ve sabit sahne renkleri korunmuştur.

## Doğrulama
- Tema türü, tercih doğrulaması, çözümleyici, sağlayıcı ve görünüm seçeneklerinin `mustard` desteği birlikte güncellenmiştir.
- Otomatik mod tüm cinsiyetler ve cinsiyet bilgisi olmayan hesaplar için `mustard` döndürür; sistem ve açıkça seçilmiş modlar kendi davranışlarını korur.
- Yönetici ve keşfet ekranlarının ortak tema hook’larını kullandığı kod üzerinden kontrol edilmiştir.
- Bu oturumda derleme veya cihaz testi çalıştırılmamıştır. Cihazda kontrol: varsayılan görünüm; giriş/kayıt; kullanıcı/yönetici ekranları; 320 px görünüm seçenekleri; tema değiştirme ve yeniden açılışta tercihin korunması.

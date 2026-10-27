# Gönderiler, Keşfet ve işletme profili kontrolleri

- Gönderi kartındaki beğeni butonu/sayacı ve Sponsorlu etiketi kaldırıldı. Sponsorluk ve beğeni verileri değiştirilmedi.
- Paylaş butonu iOS/Android paylaşım penceresini açar; görsel URL’sini, açıklamayı ve işletme bağlantısını paylaşır. Web önizlemede paylaşım metni panoya kopyalanır; sonuç veya hata bildirilir. Kaydet işlevi korunur.
- Gönderilerde Yeme-İçme ve Eğlence / Güzellik ve Bakım seçimi eklendi. Eski kategori kimlikleri mevcut kategori eşlemesiyle filtrelenir. Kategori değişimi rastgele sırayı bozmaz.
- Keşfet sıralama açıklaması gizlendi; Önerilen ve En yüksek puan seçenekleri daha küçük görsel kontrollerle gösterilir. Dokunma alanı 48 pt olarak korunur. En düşük puan seçeneği kaldırıldı.
- İşletme profilinden Aktif siparişler, Geçmiş siparişler ve birleşik sipariş/rezervasyon geçmişi bağlantıları kaldırıldı. Kullanıcının Profil ekranındaki geçmişi korundu. Menü, sipariş verme, rezervasyon/randevu oluşturma işlevleri korunur.
- Yorumlar sekmesi ve bölüm başlığı Değerlendirin olarak değiştirildi. Puanlama akışı ve hesap yetkileri değişmedi.
- Veritabanı, RLS, yönetici yetkileri ve geçmiş kayıtları değiştirilmedi.

## Doğrulama

Regresyon kontrolleri: `runFeedOrderChecks()` ve Expo uyumlu test ortamında `runPostsPresentationChecks()`. Bu oturumda bir test çalıştırıcısı veya cihaz çalıştırması yapılmadı.

Cihaz kontrolü: iki gönderi kategorisi arasında geçiş, kategori bazlı boş durum, yenileme sonrası rastgele sıra, paylaşım iptali/başarısı, kaydet/kayıttan çıkar, küçük ekranda kompakt sıralama seçenekleri, işletmeden menü/rezervasyona erişim ve kullanıcı Profil ekranında geçmişe erişim.

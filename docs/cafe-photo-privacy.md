# Mekân katılımında isim ve fotoğraf gizliliği

- Tüm işletme kategorileri desteklenir; sosyal katılım işletmenin tercihidir. Onaylı/yayında işletme, kayıtlı gerçek koordinatlar ve 40 metreden yakın müşteri konumu gerekir. GPS hassasiyeti en fazla 20 m olmalıdır.
- Genel profil paylaşımı Hesap Bilgilerim ve Mekândakiler bölümünden kapatılabilir. Bu tercih sunucuda hesap bazında saklanır; kapatmak mevcut ziyaretin görünürlüğünü de kapatır. Yeniden açmak eski görünürlüğü otomatik yayınlamaz.
- Her yeni girişte varsayılan gizli görünürlük korunur. Bu girişte Göster seçilirse ad, sansürlü soyad (ör. Ayşe Y***) ve varsa fotoğraf görünür. Gizliyken veya kişiye özel ret engelinde yalnızca Kullanıcı kartı gösterilir; fotoğraf yolu, Instagram düğmesi ve tam isim verilmez. Anonim kartlarda görüntüleyene özel opak kimlik kullanılır.
- Gizli profiller doluluk hesabına dahildir ve mekândaki diğer katılımcıları görebilir. Ret engeli yalnızca isteği gönderen kişiye uygulanır, diğer kişileri etkilemez.
- Instagram isteğini reddetmek veya izni kaldırmak ad ve fotoğrafı gönderen kişiden 7 gün gizler; yeni isteği engeller. Aynı mekânda hâlâ Kullanıcı olarak görünür. Mevcut karar tarihleri korunarak eski retler de 7 günlük kuralla değerlendirilir.
- Katılım 5 dakika sürer; GPS doğrulamasıyla yenilenir. Arka plan konumu veya otomatik katılım yoktur. Ham müşteri koordinatları kaydedilmez.
- 512×512 JPEG fotoğraflar en fazla 1 MB olarak özel cafe-profile-photos bucket'ında saklanır. Public/signed URL üretilmez. İndirmede aktif hesap, aynı mekânda aktif katılım, açık işletme ve kullanıcı görünürlüğü ile ret engeli doğrulanır.
- Fotoğraflar yalnızca bellekte tutulur; expo-image cachePolicy none kullanılır. 10 saniyelik polling, ayrılma, süre bitimi, gizleme veya indirme hatası mevcut görüntüyü kaldırır. Daha önce görülen fotoğraf veya alınan ekran görüntüsü geri alınamaz.
- İşletme/yönetici rolü müşteri fotoğrafına ek erişim vermez. Tam soyad, e-posta, telefon, müşteri koordinatları ve Instagram adresi katılımcı çıktısında bulunmaz.
- Ayrıntılar ve gerçek cihaz testleri: docs/cafe-arrival-prompt.md; sunucu regresyonu: supabase/tests/venue_presence_40m_privacy_read_only.sql.

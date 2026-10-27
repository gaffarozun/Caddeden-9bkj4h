# Onaysız kullanıcı girişi ve ayrı yönetici listeleri

20 Ekim 2026

## Giriş davranışı

- Kullanıcı kayıtları, mevcut `handle_new_user` davranışıyla `user` olur. Girişte yönetici hesap türü kararı veya işletme giriş onayı aranmaz.
- `account_customer()` artık yalnızca aktif ve doğrulanmış kullanıcı hesabını kontrol eder. Önceden işletme sahipliği bulunan kullanıcılar da kendi işletmelerine müşteri işlemi yapma kısıtları korunarak diğer işletmelerde müşteri olabilir.
- `feedback_actor`, yıldız puanı yazma ve puanlama uygunluğu fonksiyonlarından yalnızca hesap türü kararı bağımlılığı kaldırıldı. Hesap durumu, e-posta doğrulaması, silme isteği, kendi işletmesini puanlayamama ve müşteri deneyimi özelliğinin global açma/kapama kontrolleri korunur.
- İşletme hesaplarında yönetici giriş onayı, bekleme ekranı ve yenileme davranışı korunur. Kullanıcı seçeneği işletme hesabının türünü değiştirmez; kayıtlı hesap türüne uygun giriş seçilmelidir.

## Yönetici ekranı

- Kullanıcılar, İşletmeler ve Yönetici ayrı sekmelerde listelenir. Sınıflandırma `user_profiles.role` alanına göre yapılır; bağlı işletme sayısı kullanıcıyı işletme hesabına dönüştürmez.
- Hesap türü değiştirme düğmeleri listeden kaldırıldı. Önceden verilmiş rol kararları, ilgili kayıtlar ve sunucu yetkileri değiştirilmedi.
- İşletme giriş onaylama / onayı geri alma yalnızca işletme sekmesinde bulunur. Aktifleştirme ve kısıtlama hesap türünü değiştirmez.
- Panelde Kullanıcı Girişleri ve İşletme Girişleri ve Onayları bağlantıları doğru sekmeyi doğrudan açar.
- Mevcut `list_users` API'si ve doğrulanmış `businesses_owner_id_fkey` sahiplik sorgusu değiştirilmedi.

## Sürekli yetki doğrulama sorununun kaynağı ve düzeltme

- Eski `useRouteAccess` her yeni `authUser` nesnesinde ağ üzerinden tekrar yetki kontrolü başlatıp doğrulama durumunu sıfırlıyordu; boundary bu sırada editörü kaldırıyordu. Mevcut servislerdeki `getUser()` çağrılarının aynı kullanıcı için `SIGNED_IN` olayı oluşturması da yeniden profil okumasını tetikleyebiliyordu. Ağ kayıtlarında arka arkaya `getUser` ve başarılı `account_can_manage` çağrıları görüldü; PostgreSQL hata günlüğünde hata bulunmadı.
- Route boundary artık yalnızca yüklenen DB profilindeki hesap türü ve işletme onayına göre ekran kategorisini kontrol eder; fazladan ağ doğrulaması yapmaz. İşlem bazlı sahiplik ve güncel onay kontrolleri mevcut servislerde ve RLS/RPC'de aynen devam eder.
- AuthProvider eşzamanlı profil okumalarını birleştirir ve profil alanları değişmediyse nesne kimliğini korur. Aynı hesaptan gelen tekrar `SIGNED_IN` olayları yeni okuma başlatmaz; ilk yükleme, gerçek hesap değişimi, kullanıcı güncellemesi, ön plana dönüş ve 30 saniyelik arka plan yenilemesi korunur.
- Kullanıcı UI yetenekleri için fazladan `account_customer` RPC'si kaldırıldı; UI DB profilinden türetilir. Yazma işlemlerinde sunucu kontrolü devam eder.
- İlk oturum/profil okuması 12 saniye ile sınırlandı. Başarısızlıkta sonsuz bekleme yerine yeniden deneme gösterilir; giriş sayfasına erişim hata kaplamasıyla engellenmez.
- İşletme düzenleme ekranının veri yükleme bağımlılıkları tüm profil nesnesi yerine kullanıcı kimliği, hesap türü ve işletme erişimiyle sınırlandı.

## Doğrulama

Salt okunur SQL kontrolleri başarılı:

- Kullanıcı erişimi yönetici kararına bağlı değil; kullanıcıya işletme yönetim yetkisi verilmez.
- İşletme giriş onayı kontrolü, yıldız puanlama uygunluğu ve özel sipariş/rezervasyon RLS kapsamları korunur.
- Mevcut yetkili yönetici `account_admin()` kontrolünü geçer; özel rol/onay RPC'leri istemciye açılmadı.
- Önce/sonra profil, işletme giriş onayı ve RLS hash'leri birebir aynı: 5 hesap (3 kullanıcı, 1 işletme, 1 yönetici), 12 işletme.
- Hiçbir mevcut hesap, sahiplik, rol, işletme kaydı, foreign key veya RLS politikası değiştirilmedi ya da silinmedi.

Çalıştırılabilir terminal veya oturumla UI etkileşim aracı bulunmadığı için derleme ve gerçek cihaz giriş testleri yapılmadı. Yayın sonrası kullanıcı girişi, bekleyen/onaylı işletme girişi, iki yönetici liste bağlantısı ve işletme düzenleyicide 30 saniyelik yenilemeden sonra alanların korunması cihazda kontrol edilmelidir.

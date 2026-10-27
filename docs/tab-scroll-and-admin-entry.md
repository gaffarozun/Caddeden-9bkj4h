# Sekme kaydırması ve yönetici girişi

## Davranış
- Keşfet, Gönderiler ve her iki Profil sekmesinin listesi, kendi sekme düğmesine basıldığında sıfır kaydırma konumuna döner. Başka sekmeden geçiş ve açık sekmeye yeniden basma desteklenir.
- Dinleyici `tabPress` olayını kullanır; ayrıntı sayfasından geri gelmek listeyi sıfırlamaz. Kaydırma işlemi içerikleri yenilemez, sıralamayı veya filtreleri değiştirmez.
- Dinleyici ve bekleyen animasyon karesi bileşen kaldırıldığında temizlenir.
- Tek Yönetici Girişi satırı yalnızca işletme Profil sayfasında, e-postası `caddeden.app@gmail.com`, sunucu profili rolü `admin`, durumu `active` olan hesap için görünür. Müşteri Profil sayfasında bu hesap dahil kimseye gösterilmez.
- Yetkili aktif yönetici ana yönlendirmeden işletme sekmelerine ulaşır. İşletme sekmelerinin erişim sınırı bu yöneticiye izin verir; diğer işletmelerin mevcut onay kontrolü korunur.
- Oturum yüklenirken, işlem sürerken, profil okunamadığında veya şifre kurtarma sırasında yönetici satırı gizlidir. E-posta eşleşmesi tek başına yönetici rolü vermez.
- Eski `admin-setup` bağlantısı artık rol atama veya kurulum kodu formu açmaz; yetkili yönetici panele, diğer hesaplar profilsayfasına yönlendirilir.
- Mevcut sunucu izinleri ve hesap kayıtları değiştirilmedi. Salt okunur veritabanı kontrolünde hedef e-posta için bir aktif yönetici hesabı ve `account_admin()` içindeki sunucu e-posta kontrolü doğrulandı.

## Kontroller
Saf görünürlük kuralları: `tests/adminEntryChecks.ts` içindeki `runAdminEntryChecks()`.

Cihazda manuel doğrulama:
1. Keşfet, Gönderiler ve Profil listelerini aşağı kaydırın. Her açık sekmeye yeniden basın; liste başa gelmeli.
2. Aşağı kaydırılmış listeden başka sekmeye geçip önceki sekmenin düğmesine basın; liste başa gelmeli.
3. İşletme ayrıntısına girip geri dönün; kaydırma konumu ve filtreler korunmalı.
4. Misafir, müşteri ve normal işletme hesaplarında Yönetici Girişi ve eski kurulum formunun görünmediğini kontrol edin.
5. Hedef aktif yöneticiyle giriş yapın: işletme Profil ayarlarında yalnızca bir Yönetici Girişi satırı görünmeli ve panele ulaşmalı. Keşfet üzerinden açılan müşteri Profil sayfasında satır görünmemeli.
6. Eski `admin-setup` doğrudan bağlantısını yetkisiz hesapla açın; yönetici olma formu açılmamalı.

Manuel iOS/Android kontrolleri bu oturumda çalıştırılmadı.

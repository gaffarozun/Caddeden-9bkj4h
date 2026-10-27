# Kullanıcı hesabından çıkış

## Bulgular

26 Ekim 2026 Auth günlüklerinde `/auth/v1/logout?scope=global` için 403 ve `Session from session_id claim in JWT does not exist` görüldü. Ağ kayıtlarında ayrıca 204 yanıtı bulunuyor. Sunucu oturumu sona ermişken cihazdaki/arayüzdeki oturumun çıkışa engel olmaması gerekir.

## Düzeltme

- Çıkış mevcut ortak SDK istemcisiyle `scope: local` kullanır; diğer cihazlar etkilenmez.
- SDK oturum deposunun gerçekten boş olduğu doğrulanır. Eski SDK'nın 401/403/404 durumunda oturumu bıraktığı durumda yalnızca SDK'nın kendi `_removeSession` temizliği kullanılır. Tahmini anahtarlar veya tüm AsyncStorage silinmez; template değişmez.
- Çıkış, giriş/kayıt işlemleriyle aynı kilidi ve bekleme durumunu kullanır. Önceden başlamış profil okumaları sürüm kontrolüyle geçersiz kılınır; çıkış sırasında yeni profil okuması/otomatik yenileme başlatılmaz.
- Başarıda kimlik, profil hatası ve şifre kurtarma durumu sıfırlanır; profil çıkış akışı giriş ekranına döner. Gerçek bağlantı/depolama hatası gösterilir; başarısız çıkış başarı gibi sunulmaz.
- Çıkış beklerken profil işlem satırları devre dışıdır. Hesap, sipariş, kayıtlı içerik ve yetki verileri silinmez.

## Kontrol

`tests/sessionLogoutChecks.ts` gerçek hesaplara dokunmadan normal, süresi dolmuş, tekrarlanan ve başarısız çıkış senaryolarını doğrular. Bu oturumda test çalıştırma aracı mevcut değildir; otomatik koşum ve cihaz doğrulaması yapılmadı.

iOS/Android/Live Preview için: kullanıcı girişi → Profil → Çıkış → onay → giriş ekranı; uygulamayı yeniden açınca eski kullanıcı geri gelmemeli. Tekrar çıkış, hızlı çift dokunma, iptal, yavaş ağ, başka cihazda açık oturum ve yeniden giriş ayrıca kontrol edilmeli. İşletme/yönetici rolü ve erişim denetimleri değişmemeli.

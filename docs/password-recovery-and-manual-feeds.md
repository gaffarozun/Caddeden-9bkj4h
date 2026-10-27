# Şifre yenileme ve kullanıcı kontrollü akışlar

## Şifre yenileme

Kullanıcı ve İşletme girişlerinde **Şifremi unuttum** bağlantısı aynı gerçek Supabase Auth şifre sıfırlama akışını açar.

- `resetPasswordForEmail` mevcut hesabın e-posta adresine sıfırlama e-postası gönderir; kullanıcı oluşturmaz.
- `password-reset` ekranı bağlantıdan PKCE kodu, recovery token hash veya mobil recovery oturumunu doğrular. Fragment oturum işleme yalnızca şifre yenilemeye aittir; OAuth akışı değildir.
- E-posta şablonu kod içeriyorsa Supabase "Email OTP Length" ayarındaki uzunlukta (varsayılan **6 haneli**; `EXPO_PUBLIC_RECOVERY_OTP_LENGTH` ile eşlenir) recovery OTP de doğrulanabilir. E-posta şablonuna `{{ .Token }}` eklenmezse yalnızca bağlantı kullanılır. Kayıt OTP akışı değiştirilmedi; burada yalnızca `type: recovery` kullanılır.
- Yeni şifre en az **6 karakter** olmalı ve tekrar alanıyla eşleşmelidir.
- Doğrulama tamamlanmadan yeni şifre kaydedilmez; kaydetmeden önce sunucu kullanıcısı doğrulanan kullanıcıyla karşılaştırılır.
- AuthProvider recovery oturumunu normal giriş olarak kullanmaz; müşteri/işletme paneline yönlendirme yerine şifre yenileme ekranını açar.
- Başarı veya iptal sonrası recovery oturumu yerel olarak kapatılır. Başarı ekranından normal giriş ekranına dönülür. Oturum kapatılamazsa görünür hata gösterilir.
- Rol, hesap onayı, işletme sahipliği, profil alanları, veri veya RLS kuralları değiştirilmez. Kayıtlı hesap varlığını ifşa etmeyen e-posta gönderim mesajı kullanılır.
- Yeniden gönderme için ekranda 60 saniyelik bekleme bulunur; sunucu e-posta hız limitleri de geçerlidir.

### Gerekli Cloud ayarı

Cloud → Users → Auth Settings → Redirect URLs bölümüne **`onspaceapp://password-reset`** eklenmelidir. Mobil uygulamanın mevcut `onspaceapp` scheme ayarı korunur. Tarayıcıda test yapılacaksa tarayıcıdaki uygulama adresinin `/password-reset` yolu da izin listesine eklenmelidir. E-posta bağlantısı bu adreslere dönmelidir; aksi halde Auth sunucusu Site URL'ye dönebilir.

Reset Password e-posta şablonu bağlantı içeriyorsa `{{ .ConfirmationURL }}` kullanın. Kod seçeneği isteniyorsa şablona `{{ .Token }}` ekleyin. Kodun uzunluğu mevcut Auth ayarında 4'tür. Özel şablonda doğrudan token-hash bağlantısı kullanılıyorsa `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` desteklenir. Yönetilen Auth e-posta/redirect ayarları bu oturumda değiştirilmedi.

Canlı önizleme yerel mobil derin bağlantıları doğrulamaz. İzin listesi ve e-posta şablonuyla birlikte kurulu iOS/Android uygulamasında bağlantı dönüşü, sıcak/soğuk başlangıç, süresi dolan bağlantı, yanlış OTP, tekrar gönderim, iptal ve başarılı şifre değişimi test edilmelidir. Bu oturumda cihaz veya derleme testi çalıştırılmadı.

## Keşfet ve Gönderiler

- Sekme ilk açıldığında bir kez yüklenir.
- Sonraki yenilemeler yalnızca **Yenile** düğmesi, aşağı çekme veya hata ekranındaki **Yeniden dene** ile yapılır.
- Sekmeye geri dönmek, uygulamayı öne getirmek, AuthProvider'ın profil kontrolü ve RatingProvider'ın 30 saniyelik revizyonu artık bu listeleri yeniden sorgulamaz veya karıştırmaz.
- Rastgele sıra ilk yüklemede ve açık kullanıcı yenilemesinde belirlenir. Kategori, alt kategori ve sıralama seçimi mevcut liste üzerinde çalışır.
- Menü araması yeni sorgu/filtre veya açık yenileme ile çalışır; sekme odağı ve puan revizyonuyla sıfırlanmaz. Kullanıcının daha fazla ürün yüklemesi korunur.
- Yenileme başarısızsa mevcut kartlar ve sıraları korunur, görünür hata gösterilir. Aynı anda birden fazla liste yenilemesi engellenir; unmount sonrası eski yanıtlar uygulanmaz.
- Önceden var olan demo içerikler korunur; yeni mock/auth eklenmez.
- Kampanya, Cadde TV, rol/izin kontrolü ve işletme detaylarının mevcut davranışı bu değişikliğin kapsamı dışındadır.

### Kontrol listesi

1. Keşfet'te görünen işletme kimliklerini/sırayı kaydedin; 60 saniye bekleyin, Gönderiler'e gidip geri dönün ve uygulamayı arka plana alıp açın: liste yeniden yüklenmemelidir.
2. İşletme detayında puan verip Keşfet'e dönün: kullanıcı yenilemeden ana liste yeniden yüklenmemelidir; detayın puan davranışı korunmalıdır.
3. Yenile'ye veya aşağı çekmeye basın: bir yükleme göstergesi ve bir yeni liste isteği olmalıdır.
4. Gönderiler'de aynı odak/arka plan/yenileme senaryolarını deneyin; kayıtlı gönderi durumları çalışmaya devam etmelidir.
5. Ağ hatasında mevcut kartların kalmasını ve hata/yeniden dene düğmesini doğrulayın.
6. Ürün arayın, başka sekmeye gidip dönün: sonuçlar korunmalıdır. Sorgu değişikliği arama yapmalı, fiyat sırası düşükten yükseğe kalmalıdır.

`tests/passwordRecoveryChecks.ts` yalnızca parse ve alan doğrulama için çağrılabilir saf kontroller içerir; sunucuya istek yapmaz ve bu oturumda çalıştırılmadı.

# İşletme hesabı giriş onayı

## Akış
- İşletme hesapları mevcut e-posta/şifre ve OTP sistemiyle kayıt olur ve kimlik doğrulayabilir. Kimlik doğrulama, işletme paneline erişim izni anlamına gelmez.
- Kayıt tamamlandığında `/business-approval` ekranında **Yönetici tarafından onay bekleniyor** mesajı gösterilir. Sayfayı yenile butonu, aşağı çekerek yenileme ve çıkış yapma vardır.
- **Yönetici → İşletme Giriş Onayları** veya **Yönetici → Kullanıcılar** ekranında ilgili işletme hesabının **İşletme girişini onayla** butonu kullanılır.
- Mevcut rolü kullanıcı olan eski işletme sahipleri için önce hesap türü yönetici tarafından işletme olarak belirlenir; ardından ayrı giriş onayı verilir. Roller otomatik değiştirilmez.
- Onay ve hesap aktifliği sunucudan doğrulanınca işletme paneline yönlendirme yapılır. Yenile butonu hemen kontrol eder; mevcut AuthProvider ayrıca ön plandaki oturumları 30 saniyede bir ve uygulama tekrar aktif olduğunda kontrol eder.
- Yönetici giriş onayını geri alabilir. Oturum bir sonraki kontrolünde bekleme ekranına döner; API/veritabanı yetkileri ise geri alma işleminden itibaren kapalıdır.
- Kısıtlanan/yasaklanan hesapların giriş onayı olsa bile işletme paneli açılmaz. Bekleme ekranı bu durumu giriş onayı bekleyen durumdan ayrı açıklar.
- İşletme hesabı giriş onayı ile işletme profili yayın onayı ayrıdır. Bu özellik işletmelerin yayın, reklam veya içerik onaylarını değiştirmez.

## Güvenlik
- Ek `business_account_approvals` tablosu kullanılır. Onay kaydının olmaması da bekliyor olarak yorumlanır; hiçbir mevcut hesap otomatik onaylanmaz.
- İşletme rolüne yeni geçen kayıtlar için trigger bekleyen karar ve yönetici bildirimi oluşturur. İşletme rolünden çıkıp tekrar dönmek eski bir onayı yeniden kullanamaz.
- RLS yalnızca hesabın kendi kararını okumasına izin verir. Anonim/normal istemcilerin insert/update/delete yetkisi ve yönetici onay RPC'sini çalıştırma yetkisi yoktur.
- `account_active`, `account_business_access`, mevcut `account_can_manage` ve dolayısıyla işletme yönetimi RLS/Storage kontrolleri onay kapısını uygular.
- Henüz bir işletmesi olmayan hesaplarda dahi `requireBusinessAccess()` sunucu RPC'sini kontrol eder; yalnızca istemcideki rol veya hesap durumu yeterli değildir.
- Onay işlemi admin-api üzerinden doğrulanmış tek yönetici kimliğiyle çağrılır. Karar ve admin_logs kaydı aynı veritabanı işlemi içinde yazılır.
- Kök navigator bağlı kalır; onaysız işletme hesapları farklı bir ekrana doğrudan giderse bekleme ekranı mevcut navigatorın üzerinde etkileşimi engeller. Alt ekranların erişilebilirlik ağacı da gizlenir. Sunucu kontrolleri bu UI katmanından bağımsızdır.

## Değişen dosyalar
- Yeni service: `services/businessApprovalService.ts`.
- Yeni hooks: `hooks/useBusinessApproval.ts`, `hooks/useAdminBusinessApproval.ts`.
- Yeni UI/route: `components/feature/BusinessApprovalView.tsx`, `app/business-approval.tsx`.
- Mevcut auth/account access servisleri, context'leri, route kontrolleri, root/index/auth ekranları ve yönetici kullanıcı/bildirim/anasayfa ekranları güncellendi.
- `supabase/functions/admin-api/index.ts` yeni giriş onayı işlemini ve kullanıcı listesindeki onay durumunu sunar.
- Migration: `supabase/migrations/20261020_business_account_approval.sql`.
- Read-only kontrol: `supabase/tests/business_account_approval_read_only.sql`.

## Doğrulama ve sınırlar
- Migration canlı veritabanına uygulandı; herhangi bir mevcut hesap, rol, işletme veya işlem verisi güncellenmedi/silinmedi.
- Son sayım: 4 hesap, 11 işletme, 3 sipariş, 2 rezervasyon, 0 değerlendirme. Mevcut business rolündeki hesap sayısı 0; onay tablosunda başlangıçta kayıt yok.
- RLS açık; authenticated rolünde onay tablosu insert/update/delete yetkileri ve yönetici onay RPC'si execute yetkisi kapalı. Read-only SQL kontrolleri geçti.
- Mevcut kullanıcı/yönetici hesaplarının account_active davranışı read-only rol simülasyonuyla doğrulandı. İstemci metadata'sındaki sahte onay alanları yetki kaynağı olarak kullanılmaz.
- Yeni admin_alerts türüyle çakışan bir check constraint bulunmadığı doğrulandı. İnceleme sırasında PostgreSQL hata kaydı bulunmadı.
- Gerçek işletme hesabı kaydı, OTP/şifre giriş, yöneticinin gerçek oturumuyla onaylama, onay geri alma, cihaz deep link testi ve uçtan uca bekleme → aktif panel geçişi **test edilmedi**. İşletme fixture'ı olmadığı için SQL testinin işletme dalları da henüz çalıştırılmadı.
- Bu oturumda derleme veya fiziksel cihaz testi çalıştırılmadı; bu akışlar başarılı test olarak raporlanmaz.

# Caddeden — Kullanıcı/işletme rol ayrımı uygulama raporu

Tarih: 20 Ekim 2026.

## Onay, yedek ve veri koruması

Kullanıcı Data dışa aktarımı ve Storage yedeklemesinin tamamlandığını bildirdi. Yedeklerin içeriği veya geri yüklenebilirliği bu oturumda bağımsız doğrulanmadı. Mevcut hesap türlerini yönetici tek tek belirleyecek; hiçbir mevcut hesabın rolü otomatik değiştirilmedi.

Son salt okunur veritabanı kontrolü: **4 hesap (3 user, 1 admin), 11 işletme, 3 sipariş, 2 rezervasyon/randevu, 0 deneyim değerlendirmesi ve 0 bağımsız yıldız kaydı**. İşletmelerin 11'i onaylı/yayında. Yeni karar tablosunda mevcut hesaplar için karar oluşturulmadı. Hesap, işletme, sahiplik, sipariş, rezervasyon ve medya kayıtları silinmedi veya yeniden oluşturulmadı.

## Yapılan değişiklikler

### Hesap türü ve giriş
- İlk kayıt isteğinin kullanıcı/işletme seçimi OTP isteğiyle iletilir; `handle_new_user` yalnızca ilk hesap oluşturulurken `user` veya `business` rolünü atar. Yönetici atama/erişim akışları korunur.
- Profil veya metadata değiştirerek hesap türü değiştirmek engellendi. İstemci profil güncellemesi artık `role` yazmaz.
- Giriş ekranı seçilen hesap türünü veritabanındaki gerçek rolle karşılaştırır. Yanlış giriş türünde açıklayıcı hata verir; hesap dönüştürmez.
- OTP, şifre, mevcut kimlik alanları, profil düzenleme ve tema seçimleri korunur; şifre tekrar alanı eklendi.
- Rol okunamadığında varsayılan müşteri yetkisi verilmez. Hata/yeniden kontrol arayüzü gösterilir.
- Auth callback içindeki asenkron veritabanı işlemleri ertelenerek oturum kilidi riski azaltıldı; oturum geri yükleme, AppState refresh ve profil/rol yenileme korunur.

### Navigasyon ve arayüz
- Müşteri sekmeleri korunur: Keşfet, Reels, Gönderiler, Profil.
- İşletme grubu eklendi: İşletmelerim, Talepler, Paylaşımlar, Profil. Talepler içinde Siparişler, Rezervasyonlar ve Randevular ayrı filtrelenir.
- Mevcut profil/fiyat düzenleme, içerik, kampanya, reklam ve bildirim ekranları yeniden kullanılır; yeni bir paralel yönetim sistemi oluşturulmaz.
- İşletme hesapları başka işletmeleri ve menülerini görüntüleyebilir; sipariş/sepet/rezervasyon/randevu ve yıldız gönderme akışları kapatılır.
- İşletme yönetim ekranları, doğrudan linkler dahil, rol ve sahiplik doğrulamasıyla korunur. Kök navigatör yetki kontrolü nedeniyle kaldırılmaz.
- Gelen talepler 15 saniyelik polling ile yenilenir; yazma hataları görünürdür ve yalnızca durum güncellemesi yapılır.

### Veritabanı ve sunucu
- Mevcut permissive RLS politikaları kaldırılmadı. Ek restrictive politikalar mevcut onay, yayın ve sahiplik koşullarıyla kesişir: işletme/menü/içerik/kampanya/reklam/bildirim yazmaları, gelen talepler ve Storage işletme medyası role/sahipliğe göre sınırlandırılır.
- `account_customer`, `account_can_manage` ve ilgili yardımcılar gerçek `user_profiles` rolünü, hesap durumunu ve doğrulanmış e-postayı kontrol eder; istemci tarafından gönderilen hesap türüne güvenmez.
- Sipariş ve rezervasyon insert işlemleri yalnızca yetkili müşteri hesabına açıktır. Talebin `user_id` değeri gerçek oturumla eşleşmelidir.
- Sipariş ürünleri ilgili işletmenin menüsüyle karşılaştırılır, toplam sunucuda hesaplanır ve minimum tutar kontrol edilir. Rezervasyon/randevu işletme hizmet türü ve hizmet sahipliğiyle doğrulanır.
- İşletme talep güncellemelerinde müşteri kimliği, işletme kimliği, ürünler, toplam ve iletişim bilgileri değiştirilemez; mevcut kayıtların durumu yönetilebilir.
- Yıldız Edge Function ve SQL kontrolleri işletme/yönetici hesaplarını reddeder; self-rating engellenir. Deneyim sistemi yöneticinin mevcut aç/kapat kararına bağlı kalır; işletme cevaplarında rol+sahiplik kontrolü güçlendirildi.
- `admin_set_account_type` yalnızca service role tarafından çağrılabilir; admin-api JWT ile yönetici kimliğini doğrular. Karar, profil rolü ve audit log aynı transaction içinde işlenir.
- Yönetici kullanıcı listesindeki karar ilişkisi, sahiplik FK'siyle yönetici FK'si karışmayacak şekilde computed relationship ile tanımlandı.

## Mevcut iki işletme sahibi hesabın durumu

**İki hesap hâlâ `user` rolündedir ve yönetici kararı bekler.** Giriş bilgileri değiştirilmedi. Bu hesapların yeni müşteri işlemleri ve işletme yönetimi karar verilene kadar kapalıdır; geçmiş işlem verileri korunur.

Yönetici: **Yönetici Paneli → Kullanıcı Yönetimi → Kullanıcı olarak onayla / İşletme olarak onayla**. Onay bir işlem kaydı oluşturur; işletme sahiplik alanlarını değiştirmez.

- İşletme olarak onaylanırsa yalnızca bağlı işletmeleri yönetebilir; müşteri işlemi yapamaz.
- Kullanıcı olarak onaylanırsa başka işletmelerde müşteri işlemleri açılır; eski sahiplik kaydı ona yönetim yetkisi vermez. Kendi adına bağlı işletmeden sipariş/rezervasyon veya self-rating yapılamaz. İşletmenin yeni yöneticisi gerekiyorsa sahiplik aktarımı ayrıca kararlaştırılmalıdır.
- Kullanıcı arayüzünde rol değiştirme veya müşteri/işletme modu anahtarı yoktur.

## Çalıştırılan kontroller

`supabase/tests/account_separation_read_only.sql` içindeki test mantığı veritabanında çalıştırıldı. Testler transaction-local JWT claim simülasyonu ve gerçek authenticated RLS rolü kullandı; gerçek kullanıcı tokenıyla HTTP çağrısı yapılmadı. Hiçbir sipariş, rezervasyon veya profil test amacıyla yazılmadı.

| Kontrol | Sonuç / kapsam |
|---|---|
| Metadata içindeki sahte business rolü kayıtlı DB rolünü geçersiz kılmıyor | Salt okunur SQL testi geçti |
| Mevcut müşteri yetkisi ve bekleyen sahip hesaplarının engellenmesi | Salt okunur SQL helper testi geçti |
| user rolündeki hesapların işletme yönetim helper yetkisi yok | Salt okunur SQL testi geçti |
| Sipariş/rezervasyon SELECT sonuçlarında yetkisiz başka müşterinin özel verisi yok | Mevcut verilerle authenticated RLS testi geçti |
| İstemcinin rol atama RPC execute izni yok; server izni var | Veritabanı yetki kontrolü geçti |
| Profil rol değişimi guard'ı, iki talep trigger'ı ve restrictive politikalar kurulu | Katalog kontrolü geçti; ilk ana migration'da 33 restrictive politika doğrulandı |
| Yıldız state canRate, gerçek müşteri yetkisi ve self-rating kısıtıyla uyumlu | 4 mevcut hesap ve 11 yayınlı işletmeyle salt okunur regression testi geçti |
| Mevcut kayıt sayıları ve mevcut roller korunuyor | Son envanter kontrolü geçti |

## Henüz test edilmeyenler

**Üretimde `business` rolünde test hesabı yok (0).** Yönetici kararları kullanıcının isteği doğrultusunda otomatik uygulanmadığından aşağıdaki olumlu/olumsuz gerçek oturum senaryoları doğrulanamadı:

1. Gerçek müşteri oturumundan başarılı sipariş oluşturma, sepet/minimum tutar ve durum takibi.
2. Gerçek işletme oturumunun başka işletmeden sipariş, rezervasyon/randevu veya yıldız göndermesinin HTTP düzeyinde reddedilmesi.
3. İki farklı business hesabının kendi işletmesini düzenleyip diğerinin profil/fiyat/kampanya/özel verilerine erişememesi.
4. Gelen sipariş, rezervasyon ve randevunun gerçek işletme oturumunda onay/red işlemleri.
5. Admin hesap türü kararının Edge Function üzerinden başarıyla kaydedilmesi ve audit log oluşturması.
6. Yeni user/business OTP kayıtları, yanlış giriş türü, mevcut hesapların şifreyle girişi ve logout akışının gerçek cihaz testi.
7. iOS/Android/Web navigasyonu, tema, polling, yeniden açılış ve deep-link testleri.
8. TypeScript build, native APK/IPA ve uçtan uca test çalıştırması. Bu ortamda build/terminal test aracı olmadığı için bunların geçtiği iddia edilmez.

SQL migration'ları başarıyla uygulandı. Edge Function kaynakları güncellendi; final yayınlama sonrasındaki gerçek JWT invocation/deployment smoke testleri henüz yapılmadı. Önceki deneyim feedback_write HTTP 500 sorunu bu oturumda gerçek yazmayla yeniden üretilmedi; çözülmüş olarak bildirilmez.

## Dosya grupları

- Giriş: `services/authService.ts`, `contexts/AuthContext.tsx`, `app/auth.tsx`, `app/index.tsx`.
- Paylaşılan yetki: `services/accountAccessService.ts`, `services/accountStateService.ts`, `contexts/AccountAccessContext.tsx`, `hooks/useAccountAccess.ts`, `hooks/useRouteAccess.ts`, `components/auth/AccountRouteBoundary.tsx`, `app/_layout.tsx`.
- İşletme navigasyonu: `app/(business-tabs)/*`, `BusinessWorkspaceView`, `AccountProfileView`, müşteri profil route'u.
- İşlemler: işletme yönetim/kayıt/istek/medya/içerik/kampanya/reklam/bildirim servisleri ve korunan route'ları; yeni `useBusinessRequests`, `BusinessRequestsView`, kayıt service/hook/view; müşteri profil/puan/deneyim hook'ları, sepet context'i.
- Yönetici: `supabase/functions/admin-api/index.ts`, `services/adminService.ts`, `hooks/useAdminAccountTypes.ts`, `app/admin/users.tsx`, ortak SmallButton disabled desteği.
- Puanlama: `supabase/functions/rating-api/index.ts`, `services/ratingService.ts`, ilgili SQL eligibility kontrolleri.
- Migration'lar: account_role_separation → account_type_decisions → account_decision_relationship → account_rating_state; bunlar bu sırayla uygulanmalıdır. Aynı tarihli dosyalar için sıraya dikkat edin; alphabetic dosya sırası bu bağımlılık sırasının yerine geçmez.
- Test: `supabase/tests/account_separation_read_only.sql`.

## Sonraki doğrulama adımı

Yönetici mevcut iki hesabın türünü belirlesin. Üretim kayıtlarını değiştirmeden ayrı müşteri ve iki işletme test hesabı ile yukarıdaki HTTP/cihaz matrisi çalıştırılsın. Native/build ve Edge invocation sonuçları alınmadan tam uçtan uca doğrulama tamamlandı denmemelidir.

# Caddeden · çalıştırma, önizleme ve derleme

> **Doğrulama durumu:** Bu belge, depodaki yapılandırmadan (`package.json`, `app.json`) derlenmiştir. Hazırlandığı ortamda npm kayıt defterine
> erişim güvenlik politikasıyla engelli olduğundan `pnpm install`, `expo lint`, Expo derlemesi, web önizlemesi ve Android/iOS paketi
> **çalıştırılamadı**. Aşağıdaki komutlar sizin bilgisayarınızda ilk kez çalışacaktır; bir hata olursa çıktısını paylaşın.

## 1) Ön koşullar
- Node.js 20 veya 22 LTS, `pnpm` (`corepack enable`), depodaki `pnpm-lock.yaml` kullanılır.
- Supabase `caddeden` projesinde `supabase/BASELINE_SETUP.md` içindeki SQL sırası uygulanmış ve `verify/readiness_check.sql` FAIL göstermiyor olmalı.

## 2) Ortam değişkenleri
```bash
cp .env.example .env
# .env içinde yalnızca şunları doldurun (Supabase > Project Settings > API):
# EXPO_PUBLIC_SUPABASE_URL=https://<proje-ref>.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon anahtar>
```
`service_role` anahtarını `.env`'e veya kaynağa yazmayın; istemci kodunda hiçbir yerde kullanılmaz (taranıp doğrulandı).

## 3) Başlatma
```bash
pnpm install
pnpm expo start            # QR kodu: telefonda Expo Go ile açın
pnpm web                   # tarayıcıda web önizlemesi (app.json: web.output=static)
pnpm android               # Android emülatör/cihaz (Android Studio + SDK gerekir)
pnpm ios                   # yalnızca macOS + Xcode
pnpm lint                  # expo lint
npx tsc --noEmit           # tür denetimi (bağımlılıklar kurulunca)
```
Not: konum, kamera/galeri ve Supabase Auth e-posta kodu akışları gerçek cihazda/Expo Go'da denenmelidir.

## 4) Android / iOS derleme (EAS)
`eas.json` eklendi (`preview` profili Android `.apk` üretir). `app.json` içinde kimlikler tanımlı DEĞİL; mağaza/test kimliğiniz kalıcı olacağından
ben seçmedim. Derlemeden önce ekleyin:
```json
"ios": { "supportsTablet": true, "bundleIdentifier": "com.<sirket>.caddeden" },
"android": { "package": "com.<sirket>.caddeden", "adaptiveIcon": { ... }, "edgeToEdgeEnabled": true }
```
```bash
npm i -g eas-cli && eas login
eas build --platform android --profile preview     # test .apk
eas build --platform ios --profile preview          # Apple Developer hesabı gerekir
```
Derin bağlantı şeması `onspaceapp://` (şifre sıfırlama yönlendirmesi) korunmuştur; değiştirirseniz Supabase Auth > Redirect URLs listesini de güncelleyin.

## 5) Elle test listesi (gerçek Supabase gerekir)
Kayıt (e-posta kodu) → giriş → oturumun uygulama yeniden açılınca korunması · kullanıcı hesabıyla işletme girişinin reddi · işletme profili/fotoğraf yükleme ·
menü ürünü · müşteri siparişi → işletme onay/yolda/teslim · yıldız/değerlendirme · yönetici girişi ve işletme onayı · iki farklı işletmenin birbirinin siparişini görememesi.

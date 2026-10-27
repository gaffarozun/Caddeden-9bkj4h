# Caddeden

Expo / React Native (Expo Router) uygulaması. Arka uç: Supabase (Auth, Postgres + RLS, Storage, Edge Functions).
Kullanıcı ve işletme hesapları ayrıdır; yönetici paneli uygulamanın içindedir (`app/admin`). Ayrı bir web paneli
kod tabanı bu depoda yoktur.

## Çalıştırma

```bash
pnpm install
cp .env.example .env      # EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY değerlerini girin
pnpm expo start           # veya: pnpm android | pnpm ios | pnpm web
```

`.env` GitHub'a yüklenmez (`.gitignore`). İstemcide yalnızca Supabase URL ve publishable/anon anahtar kullanılır;
`service_role` anahtarı asla istemciye konmaz.

## Supabase kurulumu / OnSpace Cloud'dan geçiş

Ayrıntılı adımlar: [`supabase/README.md`](supabase/README.md). Bulgular ve açık maddeler:
[`docs/supabase-integration-report.md`](docs/supabase-integration-report.md).

## Belgeler

Özellik bazlı notlar `docs/` altındadır.

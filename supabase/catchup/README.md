# Caddeden – eksik veritabanı nesnelerini tamamlama

Tek dosya: `caddeden_catchup.sql` (Supabase → SQL Editor'a tamamını yapıştırıp Run).

- Tek işlemde (transaction) çalışır; hata olursa hiçbir şey değişmez.
- Tekrar çalıştırılabilir: zaten uygulanmış adımları "ATLANDI" diye atlar (Messages sekmesi).
- `DROP TABLE`, veri silme/sıfırlama yok; mevcut tablolara yalnızca eksik sütun/politika eklenir.
- Çalıştırmadan önce/sonra salt-okunur kontrol: `supabase/verify/migration_status.sql`, `supabase/verify/readiness_check.sql`.

Bilinen davranış değişikliği: hedefte eski baseline varsa, istemcinin `businesses` silme yetkisi kaldırılır ve sipariş/rezervasyon korumaları ile `protect_admin_role` kurulur.
Yerelde test edildi (Postgres 16); gerçek Supabase üzerinde çalıştırılmadı.

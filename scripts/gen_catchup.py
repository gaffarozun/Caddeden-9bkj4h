#!/usr/bin/env python3
"""Üretir: supabase/catchup/caddeden_catchup.sql (tek dosyalık, korumalı tamamlama) ve supabase/verify/migration_status.sql (salt-okunur durum).
Girdi: <deltas.json> (her migration dosyası tek tek uygulanıp çıkarılan nesne farkları) ve <final.json> (tam zincir sonrası nesneler).
Yerel referans veritabanıyla `scripts/snapshot_migrations.py` üretir."""
import json, sys, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
deltas = json.load(open(sys.argv[1])); final = json.load(open(sys.argv[2]))
order = [f for f in deltas['order']]
BASE = '20261001_baseline_inferred_schema.sql'
ALWAYS_FIRST = ['20261002_normalize_function_sources.sql']
ALWAYS_LAST = ['20261027_function_privilege_hardening.sql']

def q(s): return "'" + s.replace("'", "''") + "'"
# fonksiyon sürüm geçmişi: imza -> [(dosya_sırası, md5)]
hist = {}
for i, f in enumerate(order):
    for sig, h in deltas['delta'][f]['function'].items(): hist.setdefault(sig, []).append((i, h))
markers = {}   # dosya -> [(kind,obj,extra)]
for i, f in enumerate(order):
    d = deltas['delta'][f]; m = []
    for kind in ('table', 'index', 'trigger', 'policy'):
        for o in d[kind]:
            if o in final[kind]: m.append((kind, o, ''))
    for o in d['column']:
        if o in final['column']: m.append(('column', o, ''))
    for sig, h in d['function'].items():
        if sig in final['function']:
            accepted = [hh for (j, hh) in hist[sig] if j >= i]
            m.append(('function', sig, ','.join(dict.fromkeys(accepted))))
    markers[f] = m

CHECK = """case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end"""
def values(ms): return ',\n   '.join('(%s,%s,%s)' % (q(k), q(o), q(e)) for k, o, e in ms)
def body(f):
    s = (root/'supabase/migrations'/f).read_text().replace('\r', '')
    lines = s.split('\n')
    # dıştaki işlem sarmalayıcısını (ilk 'begin;' ve son 'commit;') çıkar; tüm betik tek işlemde çalışır
    bis = [i for i, l in enumerate(lines) if l.strip().lower() == 'begin;']
    cis = [i for i, l in enumerate(lines) if l.strip().lower() == 'commit;']
    if bis: lines[bis[0]] = '-- (begin; kaldırıldı)'
    if cis: lines[cis[-1]] = '-- (commit; kaldırıldı)'
    assert len(bis) <= 1 and len(cis) <= 1, f
    out = '\n'.join(lines)
    assert '$mig$' not in out
    return out

# --- baseline güvenlik yenilemesi: baseline'ın ilk sürümünü uygulamış hedefler için (idempotent) ---
bl = (root/'supabase/migrations'/BASE).read_text().replace('\r', '').split('\n')
a = next(i for i, l in enumerate(bl) if l.startswith('create or replace function public.base_request_insert_guard'))
b = next(i for i, l in enumerate(bl) if l.startswith('create unique index if not exists user_profiles_single_admin'))
dp = next(l for l in bl if l.startswith('drop policy if exists base_businesses_owner_delete'))
refresh = '\n'.join(bl[a:b+1]) + '\n' + dp.split('--')[0].strip() + "\nrevoke delete on public.businesses from authenticated, anon;  -- işletme kaydı istemciden silinemez (siparişler kaybolmasın)"
assert '$mig$' not in refresh
REFRESH_NAME = 'baseline_security_refresh (baseline güvenlik nesneleri)'
bl_markers = [m for m in markers[BASE] if m[1].split('(')[0] in ('base_request_insert_guard', 'base_request_update_guard', 'protect_admin_role', 'user_profiles_single_admin') or m[0] == 'trigger' and m[1] in ('base_request_insert_guard', 'base_request_update_guard', 'protect_admin_role')]

# --- tamamlama betiği ---
parts = ["""-- =====================================================================================
-- Caddeden · TEK DOSYALIK, KORUMALI TAMAMLAMA (supabase/catchup/caddeden_catchup.sql)
-- Ne yapar: hedef veritabanında HANGİ migration'ların eksik olduğunu kendisi bulur, yalnızca eksikleri sırayla uygular,
--           uygulanmış olanları ATLAR. Hiçbir tabloyu silmez/sıfırlamaz, veri silmez, politikayı gevşetmez.
-- Güvenlik: tamamı TEK işlemdir (begin ... commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--           İki kez çalıştırmak güvenlidir (ikinci çalıştırmada her şey ATLANDI görünür).
-- Önkoşul: 20261001_baseline_inferred_schema.sql daha önce çalıştırılmış olmalı (betik bunu kendisi denetler).
-- Nasıl: Supabase > SQL Editor > New query > bu dosyanın TAMAMINI yapıştır > Run. Sonuçta 'Messages' sekmesinde
--        her dosya için ATLANDI / UYGULANIYOR satırı görünür.
-- =====================================================================================
begin;

do $catchup$
declare n int;
begin
  select count(*) into n from unnest(array['user_profiles','businesses','orders','reservations','app_config','admin_logs']) t(x)
   where to_regclass('public.'||x) is null;
  if n > 0 then
    raise exception 'ÖNKOŞUL YOK: temel tablolar bulunamadı. Önce 20261001_baseline_inferred_schema.sql çalıştırılmalı. Hiçbir değişiklik yapılmadı.';
  end if;
  raise notice 'Önkoşul tamam: temel tablolar var.';
end
$catchup$;
"""]
def guarded(name, ms, sql):
    return f"""
-- {name}
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   {values(ms)}
  ) as m(kind, obj, extra) where not ({CHECK});
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', {q(name)};
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, {q(name)};
    execute $mig${sql}$mig$;
  end if;
end
$catchup$;
"""
def always(name, sql):
    return f"""
-- {name}  (her çalıştırmada güvenle tekrarlanabilir; yalnızca tanım/yetki yeniler)
do $catchup$
begin
  raise notice 'UYGULANIYOR  (her zaman, tekrarlanabilir): %', {q(name)};
  execute $mig${sql}$mig$;
end
$catchup$;
"""
parts.append(always(REFRESH_NAME, refresh))
for f in ALWAYS_FIRST: parts.append(always(f, body(f)))
always_names = set(ALWAYS_FIRST + ALWAYS_LAST + [BASE])
status_rows = []
for f in order:
    if f in always_names: continue
    ms = markers[f]
    if not ms:
        parts.append(always(f, body(f))); continue
    parts.append(guarded(f, ms, body(f)))
for f in ALWAYS_LAST: parts.append(always(f, body(f)))
parts.append("""
notify pgrst, 'reload schema';
commit;
""")
(root/'supabase/catchup').mkdir(exist_ok=True)
(root/'supabase/catchup/caddeden_catchup.sql').write_text(''.join(parts))

# --- salt-okunur durum sorgusu ---
rows = [(REFRESH_NAME, 0, bl_markers)] + [(f, i + 1, markers[f]) for i, f in enumerate(order) if f not in ALWAYS_FIRST + ALWAYS_LAST and markers[f]]
allv = []
for name, o, ms in rows:
    for k, ob, e in ms: allv.append("(%s,%d,%s,%s,%s)" % (q(name), o, q(k), q(ob), q(e)))
status = f"""-- Caddeden: migration durum kontrolü. YALNIZCA OKUR; hiçbir tabloyu, veriyi veya ayarı değiştirmez.
-- Supabase > SQL Editor'a yapıştırıp Run'a basın. Sonuç tablosunu (ya da ekran görüntüsünü) iletin.
-- UYGULANMIŞ = dosyanın oluşturduğu/değiştirdiği her nesne hedefte var (fonksiyonlar için içerik de eşleşir).
-- UYGULANMAMIŞ = hiçbiri yok; KISMİ = bir kısmı yok ya da eski sürümde (uygulanmalı).
-- 20261002 ve 20261027 dosyaları yalnızca tanım/yetki yenilediği için listelenmez; tamamlama betiği onları her seferinde güvenle çalıştırır.
with m(file, ord, kind, obj, extra) as (values
   {',\n   '.join(allv)}
), chk as (select m.file, m.ord, m.kind, m.obj, ({CHECK}) as ok from m)
select ord as sira, file as dosya,
  case when count(*) filter (where ok) = count(*) then 'UYGULANMIŞ'
       when count(*) filter (where ok) = 0 then 'UYGULANMAMIŞ' else 'KISMİ' end as durum,
  count(*) filter (where ok) || '/' || count(*) as bulunan,
  coalesce(left(string_agg(kind||':'||obj, ', ') filter (where not ok), 300), '') as eksik
from chk group by ord, file order by ord;
"""
(root/'supabase/verify/migration_status.sql').write_text(status)
print('catchup', len(''.join(parts)), 'bytes;', sum(1 for f in order if f not in always_names and markers[f]), 'guarded files;', [f for f in order if f not in always_names and not markers[f]], 'marker-less')

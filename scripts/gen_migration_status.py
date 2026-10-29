#!/usr/bin/env python3
"""supabase/verify/migration_status.sql üretir: her migration dosyasının oluşturduğu nesneleri çıkarır,
tam uygulanmış referans veritabanında (argv[1], psql komutu) bulunmayanları eler ve salt-okunur bir durum sorgusu yazar."""
import re, sys, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
order = [l.strip().split('/')[-1] for l in (root/'supabase/apply_order.txt').read_text().splitlines() if l.strip().startswith('migrations/')]
marks = []
for i, f in enumerate(order, 1):
    s = (root/'supabase/migrations'/f).read_text()
    s = re.sub(r'--[^\n]*', '', s)
    seen = set()
    def add(kind, obj, parent=''):
        k = (kind, obj, parent)
        if k not in seen: seen.add(k); marks.append((f, i, kind, obj, parent))
    for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)', s, re.I): add('table', m.group(1))
    for m in re.finditer(r'create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)', s, re.I): add('table', m.group(1))
    for m in re.finditer(r'create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(', s, re.I): add('function', m.group(1))
    for m in re.finditer(r'create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\w+)\s+on', s, re.I): add('index', m.group(1))
    for m in re.finditer(r'create\s+trigger\s+(\w+)', s, re.I): add('trigger', m.group(1))
    for st in re.finditer(r'alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?public\.(\w+)([^;]*);', s, re.I):
        for c in re.finditer(r'add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)', st.group(2), re.I): add('column', c.group(1), st.group(1))
CHECK = """select case '{k}' when 'table' then to_regclass('public.{o}') is not null
 when 'column' then exists(select 1 from information_schema.columns where table_schema='public' and table_name='{p}' and column_name='{o}')
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='{o}')
 when 'index' then exists(select 1 from pg_indexes where schemaname='public' and indexname='{o}')
 when 'trigger' then exists(select 1 from pg_trigger where tgname='{o}' and not tgisinternal) end"""
ref = sys.argv[1:] 
keep = []
for (f, i, k, o, p) in marks:
    r = subprocess.run(ref + ['-Atc', CHECK.format(k=k, o=o, p=p)], capture_output=True, text=True).stdout.strip()
    if r == 't': keep.append((f, i, k, o, p))
vals = ',\n'.join("  ('%s',%d,'%s','%s','%s')" % m for m in keep)
out = f"""-- Caddeden: migration durum kontrolü. YALNIZCA OKUR; hiçbir tabloyu, veriyi veya ayarı değiştirmez.
-- Supabase > SQL Editor'a yapıştırıp Run'a basın. Sonuç tablosunu (ya da ekran görüntüsünü) iletin.
-- Her dosyanın oluşturduğu tablo/sütun/fonksiyon/indeks/tetikleyici hedef veritabanında aranır.
-- UYGULANMIŞ = hepsi var, UYGULANMAMIŞ = hiçbiri yok, KISMİ = bir kısmı yok (yarım kalmış olabilir).
with m(file, ord, kind, obj, parent) as (values
{vals}
), chk as (
  select file, ord, kind, obj,
    case kind
      when 'table' then to_regclass('public.'||obj) is not null
      when 'column' then exists(select 1 from information_schema.columns where table_schema='public' and table_name=parent and column_name=obj)
      when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=obj)
      when 'index' then exists(select 1 from pg_indexes where schemaname='public' and indexname=obj)
      when 'trigger' then exists(select 1 from pg_trigger where tgname=obj and not tgisinternal)
    end as ok
  from m
)
select ord as sira, file as dosya,
  case when count(*) filter (where ok) = count(*) then 'UYGULANMIŞ'
       when count(*) filter (where ok) = 0 then 'UYGULANMAMIŞ' else 'KISMİ' end as durum,
  count(*) filter (where ok) || '/' || count(*) as bulunan,
  coalesce(string_agg(kind||':'||obj, ', ') filter (where not ok), '') as eksik
from chk group by ord, file order by ord;
"""
(root/'supabase/verify/migration_status.sql').write_text(out)
print(len(keep), 'markers,', len({m[0] for m in keep}), 'files')

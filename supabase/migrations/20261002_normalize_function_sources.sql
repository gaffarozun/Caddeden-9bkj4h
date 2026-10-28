-- Caddeden · 20261002 — fonksiyon kaynaklarını normalleştir + işlem kaydı yabancı anahtar kurallarını yükselt.
--
-- NE ZAMAN: 20261001_baseline_inferred_schema.sql'den HEMEN SONRA, 20261020_independent_stars.sql'den ÖNCE.
-- Neden: baseline CRLF (Windows) satır sonlarıyla yüklenirse fonksiyon gövdeleri `begin\r\n` içerir ve
-- 20261020_independent_stars.sql şu hatayı verir: "Unexpected feedback_write entry contract".
-- Güvenli yeniden çalıştırma: EVET. Her çalıştırmada yalnızca henüz CR içeren fonksiyonları ve henüz RESTRICT/SET NULL olmayan
-- yabancı anahtarları değiştirir; hiçbir tabloya/veriye ve hiçbir güvenlik koşuluna dokunmaz. Beklenmeyen bir fonksiyon gövdesi
-- görürse üzerine yazmadan hata verir.
begin;
do $norm$
declare r record; def text; n integer:=0;
begin
 -- Satır sonu (CR) yalnızca boşluktur; fonksiyon davranışı değişmez. Yamalı sonraki migration'lar `begin` + LF bağlantı noktası arar.
 for r in select p.oid from pg_proc p join pg_language l on l.oid=p.prolang
          where p.pronamespace='public'::regnamespace and p.prokind='f' and l.lanname in ('plpgsql','sql')
            and position(chr(13) in p.prosrc)>0
            and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') loop
  def:=replace(pg_get_functiondef(r.oid),chr(13),'');
  execute def; n:=n+1;
 end loop;
 raise notice 'CR temizlenen fonksiyon sayısı: %',n;
end;
$norm$;
-- İşlem kayıtlarını koruyan yabancı anahtar kuralları (baseline'ın ilk sürümünde CASCADE idi). Veriye dokunmaz; yalnızca kural değişir.
do $fk$
declare r record;
begin
 if to_regclass('public.orders') is null or to_regclass('public.reservations') is null or to_regclass('public.businesses') is null then return; end if;
 for r in select c.conrelid::regclass as tbl, c.conname, a.attname
          from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
          where c.contype='f' and c.conrelid in ('public.orders'::regclass,'public.reservations'::regclass)
            and ((a.attname='business_id' and c.confrelid='public.businesses'::regclass and c.confdeltype<>'r')
              or (a.attname='user_id' and c.confrelid='public.user_profiles'::regclass and c.confdeltype<>'n')) loop
  execute format('alter table %s drop constraint %I',r.tbl,r.conname);
  if r.attname='business_id' then
   execute format('alter table %s add constraint %I foreign key (business_id) references public.businesses(id) on delete restrict',r.tbl,r.conname);
  else
   execute format('alter table %s alter column user_id drop not null',r.tbl);
   execute format('alter table %s add constraint %I foreign key (user_id) references public.user_profiles(id) on delete set null',r.tbl,r.conname);
  end if;
 end loop;
end;
$fk$;
do $verify$
declare f text; src text;
begin
 foreach f in array array['public.feedback_write(text,jsonb)','public.feedback_read(uuid,text,integer)'] loop
  if to_regprocedure(f) is null then raise exception '% yok. Önce 20261001_baseline_inferred_schema.sql uygulanmalı.',f; end if;
  select pg_get_functiondef(to_regprocedure(f)) into src;
  if position(chr(13) in src)>0 then raise exception '% hâlâ CR içeriyor; satır sonları temizlenemedi.',f; end if;
  if strpos(src,E'begin\n')=0 and strpos(src,'-- experience_feature_gate')=0 then
   raise exception '% beklenen baseline gövdesine sahip değil (begin + yeni satır bulunamadı). Üzerine yazılmadı; fonksiyon tanımını inceleyin.',f; end if;
 end loop;
end;
$verify$;
commit;

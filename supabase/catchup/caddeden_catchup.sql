-- =====================================================================================
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

-- baseline_security_refresh (baseline güvenlik nesneleri)  (her çalıştırmada güvenle tekrarlanabilir; yalnızca tanım/yetki yeniler)
do $catchup$
begin
  raise notice 'UYGULANIYOR  (her zaman, tekrarlanabilir): %', 'baseline_security_refresh (baseline güvenlik nesneleri)';
  execute $mig$create or replace function public.base_request_insert_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
 jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
 b public.businesses; mi public.menu_items; item jsonb; mid uuid; qty integer;
 agg jsonb:='{}'::jsonb; k text; computed numeric:=0; canon jsonb:='[]'::jsonb; recent integer;
begin
 if not (jwt_role in ('authenticated','anon') or current_user in ('authenticated','anon')) then return new; end if; -- service_role / SQL
 if auth.uid() is null then raise exception 'Bu işlem için giriş yapmalısınız.' using errcode='42501'; end if;
 perform public.feedback_actor(true);                      -- etkin, e-postası doğrulanmış, işletme sahibi olmayan müşteri
 if new.user_id is distinct from auth.uid() then raise exception 'Başkası adına işlem yapılamaz.' using errcode='42501'; end if;
 new.status:='pending';
 select * into b from public.businesses where id=new.business_id for share;
 if b.id is null or b.approval_status<>'approved' or not b.is_published or b.owner_id=auth.uid() then
  raise exception 'İşletme işlem için uygun değil.' using errcode='42501'; end if;
 new.phone:=btrim(coalesce(new.phone,''));
 if char_length(new.phone) not between 7 and 20 then raise exception 'Geçerli bir telefon numarası gerekli.' using errcode='22023'; end if;
 new.customer_name:=nullif(left(btrim(coalesce(new.customer_name,'')),120),'');
 if tg_table_name='orders' then
  select count(*) into recent from public.orders where user_id=auth.uid() and created_at>now()-interval '1 hour';
  if recent>=30 then raise exception 'Çok sık sipariş verdiniz. Biraz sonra tekrar deneyin.' using errcode='54000'; end if;
  if not coalesce(b.allow_order,false) or not coalesce(b.allow_menu,false) then raise exception 'İşletme sipariş almıyor.' using errcode='42501'; end if;
  new.address:=btrim(coalesce(new.address,''));
  if new.address='' or char_length(new.address)>500 or new.lat is null or new.lng is null
     or new.lat not between -90 and 90 or new.lng not between -180 and 180 then
   raise exception 'Teslimat adresi ve konumu gerekli.' using errcode='22023'; end if;
  new.note:=nullif(left(btrim(coalesce(new.note,'')),500),'');
  if jsonb_typeof(new.items)<>'array' or jsonb_array_length(new.items) not between 1 and 100 then
   raise exception 'Geçerli sepet gerekli.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(new.items) loop
   if jsonb_typeof(item)<>'object' or coalesce(item->>'menu_item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item->>'qty','') !~ '^[0-9]{1,2}$' then
    raise exception 'Geçersiz sepet öğesi.' using errcode='22023'; end if;
   mid:=(item->>'menu_item_id')::uuid; qty:=(item->>'qty')::integer;
   if qty not between 1 and 99 then raise exception 'Geçersiz ürün adedi.' using errcode='22023'; end if;
   agg:=jsonb_set(agg,array[mid::text],to_jsonb(coalesce((agg->>mid::text)::integer,0)+qty));
  end loop;
  for k in select key from jsonb_each(agg) loop
   qty:=(agg->>k)::integer;
   if qty>99 then raise exception 'Geçersiz ürün adedi.' using errcode='22023'; end if;
   select * into mi from public.menu_items where id=k::uuid and business_id=b.id and item_type='product';
   if mi.id is null then raise exception 'Menü değişmiş. Menüyü yenileyin.' using errcode='22023'; end if;
   canon:=canon||jsonb_build_array(jsonb_build_object('menu_item_id',mi.id,'name',mi.name,'price',mi.price,'qty',qty));
   computed:=computed+mi.price*qty;
  end loop;
  if computed<greatest(0,coalesce(b.min_order,0)) then raise exception 'Minimum sipariş tutarına ulaşılmadı.' using errcode='22023'; end if;
  new.items:=canon; new.total:=computed;
 else
  select count(*) into recent from public.reservations where user_id=auth.uid() and created_at>now()-interval '1 hour';
  if recent>=30 then raise exception 'Çok sık talep oluşturdunuz. Biraz sonra tekrar deneyin.' using errcode='54000'; end if;
  if not coalesce(b.allow_reservation,false) then raise exception 'İşletme rezervasyon/randevu almıyor.' using errcode='42501'; end if;
  if new.type not in ('reservation','appointment') or new.date is null or new.date<(now() at time zone 'Europe/Istanbul')::date
     or coalesce(new.time,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.guests not between 1 and 12 then
   raise exception 'Geçersiz rezervasyon bilgisi.' using errcode='22023'; end if;
  if new.type='appointment' then
   if not exists(select 1 from public.menu_items where id=new.service_id and business_id=b.id and item_type='service') then
    raise exception 'İşletmeye ait bir hizmet seçin.' using errcode='22023'; end if;
  elsif new.service_id is not null then
   raise exception 'Rezervasyon hizmet kimliği içeremez.' using errcode='22023';
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.base_request_insert_guard() from public,anon,authenticated;

-- Durum güncellemesi: yalnızca işletme sahibi (RLS), yalnızca `status` sütunu ve yalnızca izinli geçişler. Müşteri hiçbir durumu değiştiremez.
create or replace function public.base_request_update_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
 jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
 ok boolean;
begin
 if not (jwt_role in ('authenticated','anon') or current_user in ('authenticated','anon')) then return new; end if;
 if not exists(select 1 from public.businesses b where b.id=old.business_id and b.owner_id=auth.uid()) then
  raise exception 'Yalnızca kendi işletmenizin taleplerini yönetebilirsiniz.' using errcode='42501'; end if;
 if (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) then
  raise exception 'Yalnızca talep durumu değiştirilebilir.' using errcode='42501'; end if;
 if new.status is not distinct from old.status then return new; end if;
 if tg_table_name='orders' then
  ok:=(old.status='pending' and new.status in ('approved','rejected'))
   or (old.status='rejected' and new.status='approved')
   or (old.status='approved' and new.status in ('on_the_way','rejected'))
   or (old.status='on_the_way' and new.status='delivered');
 else
  ok:=(old.status='pending' and new.status in ('approved','rejected','cancelled'))
   or (old.status='rejected' and new.status='approved')
   or (old.status='approved' and new.status in ('rejected','cancelled','completed'));
 end if;
 if not ok then raise exception 'Bu durum geçişine izin verilmiyor (% -> %).',old.status,new.status using errcode='22023'; end if;
 return new;
end; $$;
revoke all on function public.base_request_update_guard() from public,anon,authenticated;

drop trigger if exists base_request_insert_guard on public.orders;
create trigger base_request_insert_guard before insert on public.orders for each row execute function public.base_request_insert_guard();
drop trigger if exists base_request_update_guard on public.orders;
create trigger base_request_update_guard before update on public.orders for each row execute function public.base_request_update_guard();
drop trigger if exists base_request_insert_guard on public.reservations;
create trigger base_request_insert_guard before insert on public.reservations for each row execute function public.base_request_insert_guard();
drop trigger if exists base_request_update_guard on public.reservations;
create trigger base_request_update_guard before update on public.reservations for each row execute function public.base_request_update_guard();

-- Yönetici rolü: yalnızca e-postası DOĞRULANMIŞ yetkili adrese ve tek hesaba verilebilir. service_role dahil herkes için geçerlidir.
create or replace function public.protect_admin_role()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role='admin' and (tg_op='INSERT' or old.role is distinct from 'admin') then
  if not exists(select 1 from auth.users u where u.id=new.id and lower(trim(u.email))='caddeden.app@gmail.com'
                and u.email_confirmed_at is not null and u.deleted_at is null) then
   raise exception 'Yönetici rolü yalnızca doğrulanmış yetkili e-posta hesabına verilebilir.' using errcode='42501'; end if;
  if exists(select 1 from public.user_profiles x where x.role='admin' and x.id<>new.id) then
   raise exception 'Yönetici hesabı zaten atanmış.' using errcode='42501'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.protect_admin_role() from public,anon,authenticated;
drop trigger if exists protect_admin_role on public.user_profiles;
create trigger protect_admin_role before insert or update of role on public.user_profiles for each row execute function public.protect_admin_role();
create unique index if not exists user_profiles_single_admin on public.user_profiles((role)) where role='admin';
drop policy if exists base_businesses_owner_delete on public.businesses;
revoke delete on public.businesses from authenticated, anon;  -- işletme kaydı istemciden silinemez (siparişler kaybolmasın)$mig$;
end
$catchup$;

-- 20261002_normalize_function_sources.sql  (her çalıştırmada güvenle tekrarlanabilir; yalnızca tanım/yetki yeniler)
do $catchup$
begin
  raise notice 'UYGULANIYOR  (her zaman, tekrarlanabilir): %', '20261002_normalize_function_sources.sql';
  execute $mig$-- Caddeden · 20261002 — fonksiyon kaynaklarını normalleştir + işlem kaydı yabancı anahtar kurallarını yükselt.
--
-- NE ZAMAN: 20261001_baseline_inferred_schema.sql'den HEMEN SONRA, 20261020_independent_stars.sql'den ÖNCE.
-- Neden: baseline CRLF (Windows) satır sonlarıyla yüklenirse fonksiyon gövdeleri `begin\r\n` içerir ve
-- 20261020_independent_stars.sql şu hatayı verir: "Unexpected feedback_write entry contract".
-- Güvenli yeniden çalıştırma: EVET. Her çalıştırmada yalnızca henüz CR içeren fonksiyonları ve henüz RESTRICT/SET NULL olmayan
-- yabancı anahtarları değiştirir; hiçbir tabloya/veriye ve hiçbir güvenlik koşuluna dokunmaz. Beklenmeyen bir fonksiyon gövdesi
-- görürse üzerine yazmadan hata verir.
-- (begin; kaldırıldı)
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
-- (commit; kaldırıldı)
$mig$;
end
$catchup$;

-- 20261020_independent_stars.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','business_star_ratings',''),
   ('table','experience_feature_settings',''),
   ('index','business_star_ratings_pkey',''),
   ('index','experience_feature_settings_pkey',''),
   ('policy','business_star_ratings.authenticated_select_own_star_rating',''),
   ('column','business_star_ratings.business_id',''),
   ('column','business_star_ratings.created_at',''),
   ('column','business_star_ratings.rating',''),
   ('column','business_star_ratings.updated_at',''),
   ('column','business_star_ratings.user_id',''),
   ('column','experience_feature_settings.enabled',''),
   ('column','experience_feature_settings.id',''),
   ('column','experience_feature_settings.updated_at',''),
   ('column','experience_feature_settings.updated_by',''),
   ('function','experiences_enabled()','c63fc235009e4f1c416dd9f7ad0e0839'),
   ('function','business_star_stats(p_ids uuid[])','b16d97339096003172acc1323461b2dc'),
   ('function','business_star_state(p_business_id uuid)','0fa29b69d598f94c5b6ee9ba01962108,3e4442a0ac77f499fce2b7c9b4a8186e,22af062b3bd340dcc942b5fd53d1e860'),
   ('function','submit_business_star(p_user uuid, p_business_id uuid, p_rating numeric)','f405dd385cae5aeffcb1df4e797578c0,50ce7e9c7132d956842b1f2bb19d874c,427c90fa2bc9cc971e9c7518f67716f1'),
   ('function','set_experience_feature(p_actor uuid, p_enabled boolean)','ce39a735f534ad5f86dde558f4a54481'),
   ('function','feedback_write(p_action text, p_data jsonb)','dd6f2b131979c369390152a5b64eb3c9,89dd9c5475560ec4edb53e8991ae4384,7d07ab806e3d5bd0eb0fc076459a8931'),
   ('function','feedback_read(p_business_id uuid, p_sort text, p_offset integer)','c6a462107a6dc447485f664644a78f83,cf08cb7e818929977740dbfd3df2c89e,2722818692bcc0ccaa776619bc74fe66')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_independent_stars.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_independent_stars.sql';
    execute $mig$-- Caddeden: independent half-star ratings and administrator-controlled experience access.
-- Additive tables only. Existing accounts, businesses, reviews, orders and reservations are preserved.
-- This migration does not approve the feature or seed any user votes.
-- (begin; kaldırıldı)
create table if not exists public.experience_feature_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.user_profiles(id) on delete set null
);
alter table public.experience_feature_settings enable row level security;
revoke all on public.experience_feature_settings from anon,authenticated;
grant all on public.experience_feature_settings to service_role;
insert into public.experience_feature_settings(id,enabled) values(true,false) on conflict(id) do nothing;
create table if not exists public.business_star_ratings (
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 rating numeric(2,1) not null check(rating between 0.5 and 5 and rating*2=trunc(rating*2)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(business_id,user_id)
);
alter table public.business_star_ratings enable row level security;
revoke all on public.business_star_ratings from anon,authenticated;
grant select on public.business_star_ratings to authenticated;
grant all on public.business_star_ratings to service_role;
comment on table public.business_star_ratings is 'One independent half-star vote per customer/business. Public reads expose only aggregates; writes are verified by rating-api.';
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_star_ratings' and policyname='authenticated_select_own_star_rating') then
  create policy authenticated_select_own_star_rating on public.business_star_ratings for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
create or replace function public.experiences_enabled() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select enabled from public.experience_feature_settings where id=true),false);
$$;
revoke all on function public.experiences_enabled() from public;
grant execute on function public.experiences_enabled() to anon,authenticated,service_role;
create or replace function public.business_star_stats(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(s.id::text,jsonb_build_object('rating',s.rating,'count',s.total)),'{}'::jsonb)
 from (
 select b.id,coalesce(round(avg(r.rating),1),0) as rating,count(r.user_id) as total
 from public.businesses b left join public.business_star_ratings r on r.business_id=b.id
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=r.user_id)
 where b.id=any(p_ids) and ((b.approval_status='approved' and b.is_published) or b.owner_id=auth.uid() or public.feedback_admin_allowed())
 group by b.id
 ) s;
$$;
revoke all on function public.business_star_stats(uuid[]) from public;
grant execute on function public.business_star_stats(uuid[]) to anon,authenticated,service_role;
create or replace function public.business_star_state(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare stats jsonb; own_score numeric; eligible boolean;
begin
 stats:=public.business_star_stats(array[p_business_id])->p_business_id::text;
 if stats is null then raise exception 'İşletme bulunamadı.' using errcode='42501'; end if;
 select rating into own_score from public.business_star_ratings where business_id=p_business_id and user_id=auth.uid();
 select exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and not exists(select 1 from public.businesses b where b.owner_id=p.id)
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) into eligible;
 return jsonb_build_object('rating',stats->'rating','count',stats->'count','mine',own_score,'canRate',eligible);
end; $$;
revoke all on function public.business_star_state(uuid) from public;
grant execute on function public.business_star_state(uuid) to anon,authenticated,service_role;
-- Only rating-api can supply p_user, after validating the session and confirmed email.
create or replace function public.submit_business_star(p_user uuid,p_business_id uuid,p_rating numeric) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_at timestamptz;
begin
 if p_rating is null or p_rating not between 0.5 and 5 or p_rating*2<>trunc(p_rating*2) then raise exception '0,5 ile 5 arasında, yarım yıldız adımlarıyla puan seçin.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,20261020));
 if not exists(select 1 from public.user_profiles p where p.id=p_user and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now()))
 or exists(select 1 from public.businesses where owner_id=p_user)
 or exists(select 1 from public.account_deletion_requests where user_id=p_user) then
 raise exception 'Yalnızca aktif müşteri hesapları puan verebilir.' using errcode='42501'; end if;
 if not exists(select 1 from public.businesses where id=p_business_id and approval_status='approved' and is_published) then
 raise exception 'İşletme yayında değil.' using errcode='42501'; end if;
 select max(updated_at) into previous_at from public.business_star_ratings where user_id=p_user;
 if previous_at>now()-interval '2 seconds' then raise exception 'Tekrar puan vermeden önce birkaç saniye bekleyin.' using errcode='P0001'; end if;
 insert into public.business_star_ratings(business_id,user_id,rating) values(p_business_id,p_user,p_rating)
 on conflict(business_id,user_id) do update set rating=excluded.rating,updated_at=now();
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.submit_business_star(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.submit_business_star(uuid,uuid,numeric) to service_role;
create or replace function public.set_experience_feature(p_actor uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_enabled is null or not exists(select 1 from public.user_profiles where id=p_actor and role='admin' and status='active' and lower(email)='caddeden.app@gmail.com') then
 raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 insert into public.experience_feature_settings(id,enabled,updated_by,updated_at) values(true,p_enabled,p_actor,now())
 on conflict(id) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.admin_logs(admin_id,action,detail) values(p_actor,'set_experiences_enabled',jsonb_build_object('enabled',p_enabled));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.set_experience_feature(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_experience_feature(uuid,boolean) to service_role;
-- Enforce the switch before the legacy RPC accesses any review data or performs any review write.
-- Preserve existing complaint, moderation and account-deletion branches and privileges.
do $migration$
declare source text;
begin
 select pg_get_functiondef('public.feedback_write(text,jsonb)'::regprocedure) into source;
 source:=replace(source,E'\r',''); -- yalnızca CRLF satır sonu toleransı; sözleşme kontrolü aşağıda aynen duruyor
 if strpos(source,'-- experience_feature_gate')=0 then
  if strpos(source,E'begin\n')=0 then raise exception 'Unexpected feedback_write entry contract'; end if;
  source:=replace(source,E'begin\n',E'begin\n -- experience_feature_gate\n if p_action in (''review'',''delete_review'',''suggest'',''support'',''review_reply'',''suggestion_reply'') and not public.experiences_enabled() then\n raise exception ''Müşteri deneyimleri yönetici onayı bekliyor.'' using errcode=''42501''; end if;\n');
  execute source;
 end if;
 select pg_get_functiondef('public.feedback_read(uuid,text,integer)'::regprocedure) into source;
 source:=replace(source,E'\r','');
 if strpos(source,'-- experience_feature_gate')=0 then
  if strpos(source,E'begin\n')=0 then raise exception 'Unexpected feedback_read entry contract'; end if;
  source:=replace(source,E'begin\n',E'begin\n -- experience_feature_gate\n if not public.experiences_enabled() and not public.feedback_admin_allowed() then\n raise exception ''Müşteri deneyimleri yönetici onayı bekliyor.'' using errcode=''42501''; end if;\n');
  execute source;
 end if;
end; $migration$;
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_account_role_separation.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('trigger','account_request_guard',''),
   ('policy','ads.authenticated_delete_account_owner',''),
   ('policy','ads.authenticated_insert_account_owner',''),
   ('policy','ads.authenticated_select_account_private',''),
   ('policy','ads.authenticated_update_account_owner',''),
   ('policy','business_posts.authenticated_delete_account_owner',''),
   ('policy','business_posts.authenticated_insert_account_owner',''),
   ('policy','business_posts.authenticated_update_account_owner',''),
   ('policy','businesses.authenticated_delete_account_business',''),
   ('policy','businesses.authenticated_insert_account_business',''),
   ('policy','businesses.authenticated_select_account_business',''),
   ('policy','businesses.authenticated_update_account_business',''),
   ('policy','campaigns.authenticated_delete_account_owner',''),
   ('policy','campaigns.authenticated_insert_account_owner',''),
   ('policy','campaigns.authenticated_update_account_owner',''),
   ('policy','menu_items.authenticated_delete_account_owner',''),
   ('policy','menu_items.authenticated_insert_account_owner',''),
   ('policy','menu_items.authenticated_update_account_owner',''),
   ('policy','notification_requests.authenticated_delete_account_owner',''),
   ('policy','notification_requests.authenticated_insert_account_owner',''),
   ('policy','notification_requests.authenticated_select_account_private',''),
   ('policy','notification_requests.authenticated_update_account_owner',''),
   ('policy','orders.authenticated_delete_account_request',''),
   ('policy','orders.authenticated_insert_account_request',''),
   ('policy','orders.authenticated_select_account_request',''),
   ('policy','orders.authenticated_update_account_request',''),
   ('policy','payments.authenticated_select_account_private',''),
   ('policy','reservations.authenticated_delete_account_request',''),
   ('policy','reservations.authenticated_insert_account_request',''),
   ('policy','reservations.authenticated_select_account_request',''),
   ('policy','reservations.authenticated_update_account_request',''),
   ('function','feedback_read(p_business_id uuid, p_sort text, p_offset integer)','cf08cb7e818929977740dbfd3df2c89e,2722818692bcc0ccaa776619bc74fe66'),
   ('function','feedback_write(p_action text, p_data jsonb)','89dd9c5475560ec4edb53e8991ae4384,7d07ab806e3d5bd0eb0fc076459a8931'),
   ('function','account_role()','9fa95721ca3be789a21b02808c46f495'),
   ('function','account_active()','fd65ab14d58f42ed7ae7f642d5afa08f,e53b90ee91ed302cb2d92922ee0422f8'),
   ('function','account_admin()','6fc51d494134915943fa1fcb59204b3a'),
   ('function','account_customer()','9ecb27fe4be46f7037ff9449e74d368f,2c3e6bd5730a84a3b87bf6832d62678b,2779f39b37a1883fa882acbb3adf8301'),
   ('function','account_can_manage(p_business uuid)','1c6f27cbb2325e57aed271398d1ae517'),
   ('function','account_media_owner(p_path text)','69aeeececd896ef8a1527e26b3b4fed6'),
   ('function','handle_new_user()','d2f595214bcb231d7861280b333653a1'),
   ('function','protect_user_profile_cols()','c550253303223475a2b4c15184037ee9'),
   ('function','admin_set_account_type(p_admin uuid, p_user uuid, p_role text, p_expected text)','47783a1e6c7de7e71ebe007da7533446,bc47331b07f2e1dacde7295881e3dc86'),
   ('function','account_request_guard()','89eb045111a2a1e96800190f131a10b4,672a9ee32708bd5b11d961f468a77df9')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_account_role_separation.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_account_role_separation.sql';
    execute $mig$-- Caddeden: additive role separation for profiles, businesses, requests, media and feedback.
-- No existing accounts, roles, ownership, transactions or media are migrated or removed.
-- (begin; kaldırıldı)

create or replace function public.account_role()
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select role from public.user_profiles where id=auth.uid();
$$;
create or replace function public.account_active()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.status='active' and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id));
$$;
create or replace function public.account_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.role='admin' and lower(u.email)='caddeden.app@gmail.com');
$$;
create or replace function public.account_customer()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and coalesce(public.account_role()='user',false)
 and not exists(select 1 from public.businesses b where b.owner_id=auth.uid());
$$;
create or replace function public.account_can_manage(p_business uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_admin() or (public.account_active() and coalesce(public.account_role()='business',false)
 and exists(select 1 from public.businesses b where b.id=p_business and b.owner_id=auth.uid()));
$$;
create or replace function public.account_media_owner(p_path text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_admin() or exists(select 1 from public.businesses b
 where b.id::text=split_part(p_path,'/',1) and public.account_can_manage(b.id));
$$;
revoke all on function public.account_role(), public.account_active(), public.account_admin(), public.account_customer(), public.account_can_manage(uuid), public.account_media_owner(text) from public;
grant execute on function public.account_role(), public.account_active(), public.account_admin(), public.account_customer(), public.account_can_manage(uuid), public.account_media_owner(text) to anon,authenticated,service_role;

-- Only the initial signup may read the requested account type. Metadata updates never change roles.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare assigned_role text := 'user';
begin
 if new.raw_user_meta_data->>'role'='business' then assigned_role:='business'; end if;
 if lower(trim(new.email))='caddeden.app@gmail.com' and new.email_confirmed_at is not null then assigned_role:='admin'; end if;
 insert into public.user_profiles(id,username,email,role,phone,first_name,last_name,gender)
 values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),new.email,assigned_role,
 new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'last_name',
 case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' else null end);
 return new;
end; $$;
create or replace function public.protect_user_profile_cols()
returns trigger language plpgsql as $$
declare jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
begin
 if jwt_role in ('authenticated','anon') or current_user in ('authenticated','anon') then
  if new.role is distinct from old.role then raise exception 'Hesap türünü yalnızca yönetici belirleyebilir.' using errcode='42501'; end if;
  new.status:=old.status; new.restricted_until:=old.restricted_until;
 end if;
 return new;
end; $$;

-- Service-only atomic admin decision with audit; no automatic legacy account conversion.
create or replace function public.admin_set_account_type(p_admin uuid,p_user uuid,p_role text,p_expected text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old_role text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null)
 then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_role not in ('user','business') or p_expected not in ('user','business') or p_user=p_admin then raise exception 'Geçersiz hesap türü.' using errcode='22023'; end if;
 select role into old_role from public.user_profiles where id=p_user for update;
 if old_role is null or old_role='admin' then raise exception 'Bu hesabın türü değiştirilemez.' using errcode='42501'; end if;
 if old_role<>p_expected then raise exception 'Hesap türü değişmiş. Listeyi yenileyin.' using errcode='40001'; end if;
 update public.user_profiles set role=p_role where id=p_user;
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'set_account_type',jsonb_build_object('user_id',p_user,'before',old_role,'after',p_role,'ownership_preserved',true));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.admin_set_account_type(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_account_type(uuid,uuid,text,text) to service_role;

-- Restrictive policies intersect existing permissive policies instead of replacing them.
-- This preserves public visibility and approval rules while adding role requirements.
do $$
declare op text; t text; predicate text; policy_name text;
begin
 foreach op in array array['insert','update','delete'] loop
  predicate:='(public.account_admin() or (public.account_active() and public.account_role()=''business'' and owner_id=auth.uid()))';
  policy_name:='authenticated_'||op||'_account_business';
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='businesses' and policyname=policy_name) then
   if op='insert' then execute format('create policy %I on public.businesses as restrictive for insert to authenticated with check (%s)',policy_name,predicate);
   elsif op='update' then execute format('create policy %I on public.businesses as restrictive for update to authenticated using (%s) with check (%s)',policy_name,predicate,predicate);
   else execute format('create policy %I on public.businesses as restrictive for delete to authenticated using (%s)',policy_name,predicate); end if;
  end if;
 end loop;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='businesses' and policyname='authenticated_select_account_business') then
  create policy authenticated_select_account_business on public.businesses as restrictive for select to authenticated using ((approval_status='approved' and is_published) or public.account_can_manage(id));
 end if;
 foreach t in array array['menu_items','business_posts','campaigns','ads','notification_requests'] loop
  foreach op in array array['insert','update','delete'] loop
   predicate:='public.account_can_manage(business_id)'; policy_name:='authenticated_'||op||'_account_owner';
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=policy_name) then
    if op='insert' then execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)',policy_name,t,predicate);
    elsif op='update' then execute format('create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)',policy_name,t,predicate,predicate);
    else execute format('create policy %I on public.%I as restrictive for delete to authenticated using (%s)',policy_name,t,predicate); end if;
   end if;
  end loop;
 end loop;
 foreach t in array array['orders','reservations'] loop
  foreach op in array array['select','insert','update','delete'] loop
   policy_name:='authenticated_'||op||'_account_request';
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=policy_name) then
    if op='select' then execute format('create policy %I on public.%I as restrictive for select to authenticated using (user_id=auth.uid() or public.account_can_manage(business_id))',policy_name,t);
    elsif op='insert' then execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (user_id=auth.uid() and public.account_customer())',policy_name,t);
    elsif op='update' then execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.account_can_manage(business_id)) with check (public.account_can_manage(business_id))',policy_name,t);
    else execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.account_admin())',policy_name,t); end if;
   end if;
  end loop;
 end loop;
 foreach t in array array['ads','notification_requests','payments'] loop
  policy_name:='authenticated_select_account_private';
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=policy_name) then
   execute format('create policy %I on public.%I as restrictive for select to authenticated using (public.account_can_manage(business_id))',policy_name,t);
  end if;
 end loop;
 foreach op in array array['insert','update','delete'] loop
  policy_name:='authenticated_'||op||'_account_media';
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname=policy_name) then
   predicate:='(bucket_id<>''business-media'' or public.account_media_owner(name))';
   if op='insert' then execute format('create policy %I on storage.objects as restrictive for insert to authenticated with check (%s)',policy_name,predicate);
   elsif op='update' then execute format('create policy %I on storage.objects as restrictive for update to authenticated using (%s) with check (%s)',policy_name,predicate,predicate);
   else execute format('create policy %I on storage.objects as restrictive for delete to authenticated using (%s)',policy_name,predicate); end if;
  end if;
 end loop;
end; $$;

-- Defense in depth: role + identity guards also protect authenticated direct writes.
create or replace function public.account_request_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; item jsonb; mi public.menu_items; computed numeric:=0; qty integer;
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','')='service_role' or public.account_admin() then return new; end if;
 if tg_op='UPDATE' then
  if not public.account_can_manage(old.business_id) then raise exception 'Yalnızca kendi işletmenizin taleplerini yönetebilirsiniz.' using errcode='42501'; end if;
  if (to_jsonb(new)-array['status','cancelled_at']) is distinct from (to_jsonb(old)-array['status','cancelled_at']) then
   raise exception 'Yalnızca talep durumu değiştirilebilir.' using errcode='42501'; end if;
  if tg_table_name='orders' and new.status not in ('pending','approved','rejected','delivered') then raise exception 'Geçersiz sipariş durumu.' using errcode='22023'; end if;
  if tg_table_name='reservations' and new.status not in ('pending','approved','rejected','cancelled','completed') then raise exception 'Geçersiz talep durumu.' using errcode='22023'; end if;
  return new;
 end if;
 if not public.account_customer() or new.user_id<>auth.uid() then raise exception 'Bu işlem yalnızca müşteri hesaplarına açıktır.' using errcode='42501'; end if;
 select * into b from public.businesses where id=new.business_id for share;
 if b.id is null or b.approval_status<>'approved' or not b.is_published or b.owner_id=auth.uid() then raise exception 'İşletme işlem için uygun değil.' using errcode='42501'; end if;
 new.status:='pending';
 if coalesce(trim(new.phone),'')='' then raise exception 'Telefon numarası gerekli.' using errcode='22023'; end if;
 if tg_table_name='orders' then
  if b.category not in ('restoran','market') or not b.allow_order or not b.allow_menu then raise exception 'İşletme sipariş almıyor.' using errcode='42501'; end if;
  if coalesce(trim(new.address),'')='' or new.lat is null or new.lng is null then raise exception 'Teslimat adresi ve konumu gerekli.' using errcode='22023'; end if;
  if jsonb_typeof(new.items)<>'array' or jsonb_array_length(new.items) not between 1 and 100 then raise exception 'Geçerli sepet gerekli.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(new.items) loop
   qty:=(item->>'qty')::integer;
   if qty not between 1 and 99 or qty is null then raise exception 'Geçersiz ürün adedi.' using errcode='22023'; end if;
   select * into mi from public.menu_items where id=(item->>'menu_item_id')::uuid and business_id=b.id;
   if mi.id is null or mi.item_type<>'product' or (item->>'price')::numeric is distinct from mi.price then raise exception 'Menü veya fiyat değişmiş. Menüyü yenileyin.' using errcode='22023'; end if;
   computed:=computed+mi.price*qty;
  end loop;
  if computed<greatest(0,b.min_order) then raise exception 'Minimum sipariş tutarına ulaşılmadı.' using errcode='22023'; end if;
  new.total:=computed;
 else
  if not b.allow_reservation then raise exception 'İşletme rezervasyon/randevu almıyor.' using errcode='42501'; end if;
  if new.type not in ('appointment','reservation') or new.date<current_date or new.time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.guests not between 1 and 12 then raise exception 'Geçersiz rezervasyon bilgisi.' using errcode='22023'; end if;
  if new.type='appointment' and b.category not in ('kadin_kuafor','erkek_kuafor','guzellik','berber','guzellik_salonu','protez_tirnak','cilt_bakimi','kas_kirpik','makyaj','agda_epilasyon') then raise exception 'Bu işletme randevu sunmuyor.' using errcode='22023'; end if;
  if new.type='reservation' and b.category not in ('restoran','kafe','eglence','bar','club') then raise exception 'Bu işletme rezervasyon sunmuyor.' using errcode='22023'; end if;
  if new.type='appointment' and not exists(select 1 from public.menu_items where id=new.service_id and business_id=b.id and item_type='service') then raise exception 'İşletmeye ait bir hizmet seçin.' using errcode='22023'; end if;
  if new.type='reservation' and new.service_id is not null then raise exception 'Rezervasyon hizmet kimliği içeremez.' using errcode='22023'; end if;
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='account_request_guard') then create trigger account_request_guard before insert or update on public.orders for each row execute function public.account_request_guard(); end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.reservations'::regclass and tgname='account_request_guard') then create trigger account_request_guard before insert or update on public.reservations for each row execute function public.account_request_guard(); end if;
end; $$;

-- Preserve the existing feedback projections; strengthen only their ownership predicates.
do $$ declare definition text; begin
 select pg_get_functiondef('public.feedback_read(uuid,text,integer)'::regprocedure) into definition;
 definition:=replace(definition,'select owner_id=auth.uid(),approval_status=','select public.account_can_manage(id),approval_status=');
 execute definition;
 select pg_get_functiondef('public.feedback_write(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'where id=b and owner_id=u','where id=b and public.account_can_manage(id)');
 execute definition;
end; $$;
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_account_type_decisions.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','account_type_decisions',''),
   ('index','account_type_decisions_pkey',''),
   ('policy','account_type_decisions.authenticated_select_own_account_decision',''),
   ('column','account_type_decisions.decided_at',''),
   ('column','account_type_decisions.decided_by',''),
   ('column','account_type_decisions.role',''),
   ('column','account_type_decisions.user_id',''),
   ('function','feedback_actor(p_customer boolean)','93d77c63df08f1dfecff8a4a8896d5df,41dc92330094797a4ffba807261cd584'),
   ('function','submit_business_star(p_user uuid, p_business_id uuid, p_rating numeric)','50ce7e9c7132d956842b1f2bb19d874c,427c90fa2bc9cc971e9c7518f67716f1'),
   ('function','account_customer()','2c3e6bd5730a84a3b87bf6832d62678b,2779f39b37a1883fa882acbb3adf8301'),
   ('function','account_type_pending(p_user uuid)','9995302adfc4026035f23daf47962dca'),
   ('function','admin_set_account_type(p_admin uuid, p_user uuid, p_role text, p_expected text)','bc47331b07f2e1dacde7295881e3dc86')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_account_type_decisions.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_account_type_decisions.sql';
    execute $mig$-- Explicit admin decisions for legacy user-role business owners. Ownership/history remain intact.
-- (begin; kaldırıldı)
create table if not exists public.account_type_decisions (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 role text not null check(role in ('user','business')),
 decided_by uuid not null references public.user_profiles(id),
 decided_at timestamptz not null default now()
);
alter table public.account_type_decisions enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='account_type_decisions' and policyname='authenticated_select_own_account_decision') then
 create policy authenticated_select_own_account_decision on public.account_type_decisions for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
-- No client insert/update/delete policies: decisions must use the authenticated admin API.
create or replace function public.account_type_pending(p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles where id=p_user and role='user')
 and exists(select 1 from public.businesses where owner_id=p_user)
 and not exists(select 1 from public.account_type_decisions where user_id=p_user);
$$;
revoke all on function public.account_type_pending(uuid) from public;
grant execute on function public.account_type_pending(uuid) to authenticated,anon,service_role;
create or replace function public.account_customer()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and coalesce(public.account_role()='user',false) and not public.account_type_pending(auth.uid());
$$;
create or replace function public.admin_set_account_type(p_admin uuid,p_user uuid,p_role text,p_expected text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old_role text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null)
 then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_role not in ('user','business') or p_expected not in ('user','business') or p_user=p_admin then raise exception 'Geçersiz hesap türü.' using errcode='22023'; end if;
 select role into old_role from public.user_profiles where id=p_user for update;
 if old_role is null or old_role='admin' then raise exception 'Bu hesabın türü değiştirilemez.' using errcode='42501'; end if;
 if old_role<>p_expected then raise exception 'Hesap türü değişmiş. Listeyi yenileyin.' using errcode='40001'; end if;
 update public.user_profiles set role=p_role where id=p_user;
 insert into public.account_type_decisions(user_id,role,decided_by) values(p_user,p_role,p_admin)
 on conflict(user_id) do update set role=excluded.role,decided_by=excluded.decided_by,decided_at=now();
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'set_account_type',jsonb_build_object('user_id',p_user,'before',old_role,'after',p_role,'ownership_preserved',true));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.admin_set_account_type(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_account_type(uuid,uuid,text,text) to service_role;
do $$ declare definition text; begin
 select pg_get_functiondef('public.submit_business_star(uuid,uuid,numeric)'::regprocedure) into definition;
 definition:=replace(definition,'or exists(select 1 from public.businesses where owner_id=p_user)','or public.account_type_pending(p_user)');
 -- Always reject self-rating, including owners explicitly classified as customer.
 if position('Kendi işletmenizi puanlayamazsınız.' in definition)=0 then
  definition:=replace(definition,'perform pg_advisory_xact_lock','if exists(select 1 from public.businesses where id=p_business_id and owner_id=p_user) then raise exception ''Kendi işletmenizi puanlayamazsınız.'' using errcode=''42501''; end if; perform pg_advisory_xact_lock');
 end if;
 execute definition;
 select pg_get_functiondef('public.feedback_actor(boolean)'::regprocedure) into definition;
 definition:=replace(definition,'exists(select 1 from public.businesses where owner_id=u)','public.account_type_pending(u)');
 execute definition;
end; $$;
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_account_decision_relationship.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','account_type_decisions(p_profile user_profiles)','806d33b645103247b0ca0f51c526d817')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_account_decision_relationship.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_account_decision_relationship.sql';
    execute $mig$-- Disambiguate account decision embedding from the deciding-admin FK.
-- Computed relationship chooses user_id, exposes at most one decision and respects RLS.
create or replace function public.account_type_decisions(p_profile public.user_profiles)
returns setof public.account_type_decisions rows 1 language sql stable set search_path=public,pg_temp as $$
 select * from public.account_type_decisions where user_id=(p_profile).id;
$$;
revoke all on function public.account_type_decisions(public.user_profiles) from public,anon,authenticated;
grant execute on function public.account_type_decisions(public.user_profiles) to service_role;
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261020_account_rating_state.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','business_star_state(p_business_id uuid)','3e4442a0ac77f499fce2b7c9b4a8186e,22af062b3bd340dcc942b5fd53d1e860')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_account_rating_state.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_account_rating_state.sql';
    execute $mig$-- Align rating eligibility with explicit admin account decisions while denying self-rating.
do $$ declare definition text; begin
 select pg_get_functiondef('public.business_star_state(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'and not exists(select 1 from public.businesses b where b.owner_id=p.id)',
 'and not public.account_type_pending(p.id) and public.account_active() and not exists(select 1 from public.businesses b where b.id=p_business_id and b.owner_id=p.id)');
 execute definition;
end; $$;
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261020_customers_without_approval.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','feedback_actor(p_customer boolean)','41dc92330094797a4ffba807261cd584'),
   ('function','submit_business_star(p_user uuid, p_business_id uuid, p_rating numeric)','427c90fa2bc9cc971e9c7518f67716f1'),
   ('function','business_star_state(p_business_id uuid)','22af062b3bd340dcc942b5fd53d1e860'),
   ('function','account_customer()','2779f39b37a1883fa882acbb3adf8301')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_customers_without_approval.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_customers_without_approval.sql';
    execute $mig$-- Customers no longer require an administrator's account-type decision.
-- Changes authorization functions only; roles, ownership, approvals, RLS and records are preserved.
-- (begin; kaldırıldı)
create or replace function public.account_customer() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and coalesce(public.account_role()='user',false);
$$;
do $migration$
declare definition text; target record;
begin
 for target in select * from (values
 ('public.feedback_actor(boolean)', 'p.role<>''user'' or public.account_type_pending(u)', 'p.role<>''user'''),
 ('public.business_star_state(uuid)', 'and not public.account_type_pending(p.id) and public.account_active()', 'and public.account_active()'),
 ('public.submit_business_star(uuid,uuid,numeric)', 'or public.account_type_pending(p_user)', '')
 ) as targets(signature,old_fragment,new_fragment) loop
  select pg_get_functiondef(target.signature::regprocedure) into definition;
  if strpos(definition,target.old_fragment)>0 then
   execute replace(definition,target.old_fragment,target.new_fragment);
  elsif strpos(definition,'account_type_pending')>0 then
   raise exception 'Unexpected customer decision guard in %; migration cancelled',target.signature;
  end if;
 end loop;
end; $migration$;
notify pgrst,'reload schema';
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_business_account_approval.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','business_account_approvals',''),
   ('index','business_account_approvals_pkey',''),
   ('trigger','business_account_approval_request',''),
   ('policy','business_account_approvals.authenticated_select_own_business_approval',''),
   ('column','business_account_approvals.created_at',''),
   ('column','business_account_approvals.decided_at',''),
   ('column','business_account_approvals.decided_by',''),
   ('column','business_account_approvals.status',''),
   ('column','business_account_approvals.user_id',''),
   ('function','account_active()','e53b90ee91ed302cb2d92922ee0422f8'),
   ('function','business_account_approval_request()','0ba7cdd6b4adc1cffffd1430b3dca128'),
   ('function','account_business_access()','f34cf85229660b62a5e72b62f15d1854'),
   ('function','business_account_state()','1772392bcffe46b3701ff8e1e982022a'),
   ('function','admin_set_business_account_approval(p_admin uuid, p_user uuid, p_status text)','9d9c711a05716f4bb64ba0382c55ba91')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_business_account_approval.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_business_account_approval.sql';
    execute $mig$-- Business-account login approval: additive schema and authorization only.
-- No existing accounts, roles, businesses or transaction records are changed.
-- (begin; kaldırıldı)
create table if not exists public.business_account_approvals (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved')),
 created_at timestamptz not null default now(),
 decided_by uuid references public.user_profiles(id),
 decided_at timestamptz,
 constraint business_approval_decision_valid check (status <> 'approved' or (decided_by is not null and decided_at is not null))
);
alter table public.business_account_approvals enable row level security;
revoke all on public.business_account_approvals from public,anon,authenticated;
grant select on public.business_account_approvals to authenticated;
grant all on public.business_account_approvals to service_role;
-- Accounts may read only their own decision; no client write policies exist.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_account_approvals' and policyname='authenticated_select_own_business_approval') then
  create policy authenticated_select_own_business_approval on public.business_account_approvals for select to authenticated using (user_id=auth.uid());
 end if;
end; $$;

create or replace function public.account_active() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
 and (p.role <> 'business' or exists(select 1 from public.business_account_approvals a where a.user_id=p.id and a.status='approved')));
$$;
-- Used even before an account has created its first business.
create or replace function public.account_business_access() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_admin() or (public.account_active() and coalesce(public.account_role()='business',false));
$$;
create or replace function public.business_account_state() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('status',coalesce(a.status,'pending'),'canManage',public.account_business_access(),'decidedAt',a.decided_at)
 from public.user_profiles p left join public.business_account_approvals a on a.user_id=p.id
 where p.id=auth.uid() and p.role='business';
$$;
revoke all on function public.account_business_access(),public.business_account_state() from public,anon;
grant execute on function public.account_business_access(),public.business_account_state() to authenticated,service_role;

create or replace function public.business_account_approval_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role='business' then
  if tg_op='UPDATE' then
   if old.role is not distinct from new.role then return new; end if;
  end if;
  insert into public.business_account_approvals(user_id,status) values(new.id,'pending')
  on conflict(user_id) do update set status='pending',decided_by=null,decided_at=null;
  insert into public.admin_alerts(type,ref_id,title,body)
  values('business_account_approval',new.id,'İşletme hesabı onay bekliyor','Yeni işletme hesabını Kullanıcılar bölümünden inceleyip giriş erişimini onaylayabilirsiniz.');
 end if;
 return new;
end; $$;
revoke all on function public.business_account_approval_request() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.user_profiles'::regclass and tgname='business_account_approval_request') then
  create trigger business_account_approval_request after insert or update of role on public.user_profiles for each row execute function public.business_account_approval_request();
 end if;
end; $$;

create or replace function public.admin_set_business_account_approval(p_admin uuid,p_user uuid,p_status text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_role text; previous_status text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
  where p.id=p_admin and p.role='admin' and p.status='active'
  and (p.restricted_until is null or p.restricted_until<=now())
  and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null and u.deleted_at is null
  and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('pending','approved') or p_user is null or p_user=p_admin then
  raise exception 'Geçersiz işletme hesabı onayı.' using errcode='22023';
 end if;
 select role into target_role from public.user_profiles where id=p_user for update;
 if target_role is distinct from 'business' then
  raise exception 'Yalnızca işletme hesaplarının giriş onayı değiştirilebilir.' using errcode='42501';
 end if;
 select status into previous_status from public.business_account_approvals where user_id=p_user;
 insert into public.business_account_approvals(user_id,status,decided_by,decided_at)
 values(p_user,p_status,p_admin,now()) on conflict(user_id) do update
 set status=excluded.status,decided_by=excluded.decided_by,decided_at=excluded.decided_at;
 insert into public.admin_logs(admin_id,action,detail)
 values(p_admin,'business_account_approval',jsonb_build_object('user_id',p_user,'before',coalesce(previous_status,'pending'),'after',p_status));
 return jsonb_build_object('ok',true,'status',p_status);
end; $$;
revoke all on function public.admin_set_business_account_approval(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_business_account_approval(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_feedback_criteria.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('column','business_reviews.criteria_ratings',''),
   ('function','feedback_ratings(p_ids uuid[])','6d735544f962037a169d90f28d6011e9'),
   ('function','feedback_write(p_action text, p_data jsonb)','7d07ab806e3d5bd0eb0fc076459a8931'),
   ('function','feedback_read(p_business_id uuid, p_sort text, p_offset integer)','2722818692bcc0ccaa776619bc74fe66'),
   ('function','feedback_review_score(p_scores jsonb, p_fallback integer)','c6b23446b3ccba8d2618c29ad1331ce3'),
   ('function','feedback_criteria_valid(p_scores jsonb)','9898e448b54f0067b7f7173ecc6bde0e')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_feedback_criteria.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_feedback_criteria.sql';
    execute $mig$-- Caddeden: additive per-feature ratings and direct publication of new reviews/replies.
-- Existing reviews, moderation decisions, accounts and ownership rules remain intact.
-- (begin; kaldırıldı)
alter table public.business_reviews add column if not exists criteria_ratings jsonb not null default '{}'::jsonb;

create or replace function public.feedback_criteria_valid(p_scores jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare k text; v jsonb; total integer:=0;
begin
 if p_scores is null or jsonb_typeof(p_scores)<>'object' then return false; end if;
 for k,v in select key,value from jsonb_each(p_scores) loop
  if k not in ('price','hygiene','staff','service','environment','variety') or jsonb_typeof(v)<>'number' then return false; end if;
  if (v::text)::numeric not between 1 and 5 or (v::text)::numeric<>trunc((v::text)::numeric) then return false; end if;
  total:=total+1;
 end loop;
 return total=6;
end; $$;

create or replace function public.feedback_review_score(p_scores jsonb,p_fallback integer) returns numeric
language sql immutable set search_path=public,pg_temp as $$
 select case when public.feedback_criteria_valid(p_scores)
 then (select round(avg(value::numeric),1) from jsonb_each_text(p_scores))
 else p_fallback::numeric end;
$$;

-- Empty objects are the legacy representation; new submissions require all six scores.
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.business_reviews'::regclass and conname='business_reviews_criteria_valid') then
  alter table public.business_reviews add constraint business_reviews_criteria_valid check(criteria_ratings='{}'::jsonb or public.feedback_criteria_valid(criteria_ratings));
 end if;
end; $$;

-- Patch only known branches. Abort atomically if the installed contract differs.
do $migration$
declare source text; start_at integer; end_at integer; replacement text;
begin
 select pg_get_functiondef(oid) into source from pg_proc where pronamespace='public'::regnamespace and proname='feedback_write';
 start_at:=strpos(source,'if p_action=''review'' then');
 end_at:=strpos(source,'elsif p_action=''delete_review'' then');
 if start_at=0 or end_at<=start_at then raise exception 'feedback_write review contract differs'; end if;
 replacement:=$branch$if p_action='review' then
 b:=(p_data->>'business_id')::uuid;
 if not exists(select 1 from public.businesses where id=b and approval_status='approved' and is_published) then raise exception 'İşletme yayında değil.'; end if;
 if not public.feedback_criteria_valid(p_data->'criteria_ratings') then raise exception 'Altı özelliğin her biri için 1–5 yıldız seçin.'; end if;
 txt:=trim(coalesce(p_data->>'comment',''));
 if char_length(txt)>2000 then raise exception 'Yorum en fazla 2000 karakter olmalı.'; end if;
 n:=round(public.feedback_review_score(p_data->'criteria_ratings',0))::integer;
 select key into st from jsonb_each_text(p_data->'criteria_ratings') order by value::integer desc,key limit 1;
 insert into public.business_reviews(business_id,user_id,rating,comment,topic,criteria_ratings,status)
 values(b,u,n,txt,st,p_data->'criteria_ratings','published')
 on conflict(business_id,user_id) do update set rating=excluded.rating,comment=excluded.comment,topic=excluded.topic,
 criteria_ratings=excluded.criteria_ratings,
 status=case when business_reviews.status='hidden' then 'pending' else 'published' end,
 moderation_reason=case when business_reviews.status='hidden' then business_reviews.moderation_reason else null end,
 updated_at=now();
 $branch$;
 source:=substr(source,1,start_at-1)||replacement||substr(source,end_at);
 replacement:='update public.business_reviews set reply=txt,reply_status=''pending'',reply_reason=null,reply_updated_at=now() where id=item;';
 if strpos(source,replacement)=0 then raise exception 'feedback_write reply contract differs'; end if;
 source:=replace(source,replacement,'update public.business_reviews set reply=txt,reply_status=case when reply_status=''hidden'' then ''pending'' else ''published'' end,reply_reason=case when reply_status=''hidden'' then reply_reason else null end,reply_updated_at=now() where id=item;');
 execute source;

 select pg_get_functiondef(oid) into source from pg_proc where pronamespace='public'::regnamespace and proname='feedback_read';
 replacement:='select id,rating,comment,topic,created_at,updated_at';
 if strpos(source,replacement)=0 then raise exception 'feedback_read public projection differs'; end if;
 source:=replace(source,replacement,'select id,public.feedback_review_score(criteria_ratings,rating) as rating,comment,topic,criteria_ratings,created_at,updated_at');
 replacement:='select id,rating,comment,topic,status,moderation_reason,created_at,updated_at';
 if strpos(source,replacement)=0 then raise exception 'feedback_read personal projection differs'; end if;
 source:=replace(source,replacement,'select id,public.feedback_review_score(criteria_ratings,rating) as rating,comment,topic,criteria_ratings,status,moderation_reason,created_at,updated_at');
 replacement:='select topic,count(distinct user_id) as count from public.business_reviews where business_id=p_business_id and status=''published'' and rating>=4 group by topic having count(distinct user_id)>=3 order by count desc,topic limit 1';
 if strpos(source,replacement)=0 then raise exception 'feedback_read highlights contract differs'; end if;
 source:=replace(source,replacement,'select features.key as topic,count(distinct r.user_id) as count from public.business_reviews r cross join lateral jsonb_each_text(case when public.feedback_criteria_valid(r.criteria_ratings) then r.criteria_ratings else jsonb_build_object(r.topic,r.rating) end) features where r.business_id=p_business_id and r.status=''published'' and features.value::numeric>=4 group by features.key having count(distinct r.user_id)>=3 order by count desc,features.key limit 1');
 source:=replace(source,'case when p_sort=''highest'' then rating end','case when p_sort=''highest'' then public.feedback_review_score(criteria_ratings,rating) end');
 source:=replace(source,'case when p_sort=''lowest'' then rating end','case when p_sort=''lowest'' then public.feedback_review_score(criteria_ratings,rating) end');
 execute source;

 select pg_get_functiondef(oid) into source from pg_proc where pronamespace='public'::regnamespace and proname='feedback_ratings';
 replacement:='round(avg(rating),1)';
 if strpos(source,replacement)=0 then raise exception 'feedback_ratings aggregation contract differs'; end if;
 source:=replace(source,replacement,'round(avg(public.feedback_review_score(criteria_ratings,rating)),1)');
 execute source;
end;
$migration$;

revoke all on function public.feedback_criteria_valid(jsonb),public.feedback_review_score(jsonb,integer) from public,anon,authenticated;
-- Constraint evaluation requires the safe, immutable validator; it exposes no table data.
grant execute on function public.feedback_criteria_valid(jsonb) to authenticated,service_role;
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_paid_campaign_ticker.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('index','campaigns_paid_ticker_idx',''),
   ('trigger','zzz_campaign_pricing_guard',''),
   ('policy','campaigns.anon_select_paid_campaigns',''),
   ('policy','campaigns.authenticated_select_paid_campaigns',''),
   ('column','campaigns.publication_days',''),
   ('function','campaign_pricing_guard()','aee6fad8bec9f02ddf57081df880ce8a'),
   ('function','admin_campaign_decision(p_admin uuid, p_id uuid, p_action text, p_value text, p_reason text, p_expected_status text, p_expected_payment text)','86b5e2e283dbc552385a095a314b5466'),
   ('function','public_paid_campaigns()','5f2cb65b6dbea11b4af99d042a545038'),
   ('function','submit_paid_campaign(p_business uuid, p_package uuid, p_title text, p_description text, p_image text, p_price numeric, p_days integer)','cb1b40be86bbc9c10bae80d279ea2c79')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_paid_campaign_ticker.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_paid_campaign_ticker.sql';
    execute $mig$-- Paid campaign ticker: additive pricing snapshots, read gates and atomic admin decisions.
-- Existing campaigns, accounts, packages, policies and payment history are preserved.
-- (begin; kaldırıldı)
alter table public.campaigns add column if not exists publication_days integer;

create or replace function public.campaign_pricing_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare pkg public.ad_packages; privileged boolean;
begin
 privileged:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='service_role' or current_user='service_role' or public.account_admin();
 if tg_op='INSERT' then
  if not privileged and (not public.account_active() or public.account_role()<>'business' or not public.account_can_manage(new.business_id) or not exists(select 1 from public.business_account_approvals where user_id=auth.uid() and status='approved')) then
   raise exception 'Kampanya başvurusu için onaylanmış işletme hesabı gerekli.' using errcode='42501';
  end if;
  select * into pkg from public.ad_packages where id=new.package_id for share;
  if pkg.id is null or pkg.type<>'content_campaign' or not pkg.active or pkg.price<=0 or pkg.duration_days<1 then
   raise exception 'Yönetici henüz ücretli kampanya paketi tanımlamamış veya seçilen paket satışta değil.' using errcode='22023';
  end if;
  new.title:=btrim(regexp_replace(coalesce(new.title,''),'[[:space:]]+',' ','g'));
  if char_length(new.title) not between 4 and 160 or char_length(coalesce(new.description,''))>2000 then
   raise exception 'Başlık 4–160, açıklama en fazla 2000 karakter olmalıdır.' using errcode='22023';
  end if;
  new.price:=pkg.price; new.publication_days:=pkg.duration_days;
  new.status:='pending'; new.payment_status:='unpaid'; new.rejection_reason:=null;
  new.start_date:=null; new.end_date:=null;
 else
  if not privileged then raise exception 'Kampanya ücretini, ödeme ve yayın durumunu yalnızca yönetici değiştirebilir.' using errcode='42501'; end if;
  if new.status='approved' and (new.payment_status<>'paid' or new.price<=0 or new.start_date is null or new.end_date is null or new.end_date<new.start_date) then
   raise exception 'Yayın için ücret, doğrulanmış ödeme ve geçerli yayın süresi gerekli.' using errcode='22023';
  end if;
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.campaigns'::regclass and tgname='zzz_campaign_pricing_guard') then
  create trigger zzz_campaign_pricing_guard before insert or update on public.campaigns for each row execute function public.campaign_pricing_guard();
 end if;
 -- Restrictive gates intersect existing public and ownership policies, never replace them.
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='anon_select_paid_campaigns') then
  create policy anon_select_paid_campaigns on public.campaigns as restrictive for select to anon using (status='approved' and payment_status='paid' and price>0 and start_date<=current_date and end_date>=current_date);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='authenticated_select_paid_campaigns') then
  create policy authenticated_select_paid_campaigns on public.campaigns as restrictive for select to authenticated using (public.account_can_manage(business_id) or (status='approved' and payment_status='paid' and price>0 and start_date<=current_date and end_date>=current_date));
 end if;
end; $$;

create or replace function public.admin_campaign_decision(p_admin uuid,p_id uuid,p_action text,p_value text,p_reason text default null,p_expected_status text default null,p_expected_payment text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare campaign public.campaigns; days integer; previous text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null and u.deleted_at is null and (p.restricted_until is null or p.restricted_until<=now()) and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_action is null or p_value is null or not ((p_action='status' and p_value in ('approved','rejected')) or (p_action='payment' and p_value in ('paid','unpaid'))) then raise exception 'Geçersiz kampanya kararı.' using errcode='22023'; end if;
 select * into campaign from public.campaigns where id=p_id for update;
 if campaign.id is null then raise exception 'Kampanya bulunamadı.' using errcode='22023'; end if;
 if (p_expected_status is not null and p_expected_status<>campaign.status) or (p_expected_payment is not null and p_expected_payment<>campaign.payment_status) then raise exception 'Kampanya durumu değişti. Listeyi yenileyin.' using errcode='40001'; end if;
 if p_action='status' then
  previous:=campaign.status;
  if p_value='approved' then
   if campaign.payment_status<>'paid' or campaign.price<=0 then raise exception 'Önce belirlenen ücretin ödemesini doğrulayın; ardından kampanyayı onaylayın.' using errcode='22023'; end if;
   days:=campaign.publication_days;
   if days is null then select duration_days into days from public.ad_packages where id=campaign.package_id and type='content_campaign'; end if;
   if days is null or days<1 then raise exception 'Geçerli ücretli kampanya paketi ve yayın süresi gerekli.' using errcode='22023'; end if;
   if campaign.status='approved' then return jsonb_build_object('ok',true); end if;
   update public.campaigns set status='approved',rejection_reason=null,publication_days=days,start_date=current_date,end_date=current_date+days-1 where id=p_id;
  else
   update public.campaigns set status='rejected',rejection_reason=left(nullif(btrim(p_reason),''),300) where id=p_id;
  end if;
 else
  previous:=campaign.payment_status;
  if p_value='paid' and campaign.price<=0 then raise exception 'Bu eski başvuruda ücret belirlenmemiş. İşletme ücretli paketle yeniden başvurmalıdır.' using errcode='22023'; end if;
  if p_value='unpaid' then
   update public.campaigns set payment_status='unpaid',status=case when status='approved' then 'pending' else status end,start_date=null,end_date=null where id=p_id;
  else
   update public.campaigns set payment_status='paid' where id=p_id;
   if not exists(select 1 from public.payments where note='campaign:'||p_id::text) then
    insert into public.payments(business_id,amount,status,method,note) values(campaign.business_id,campaign.price,'paid','manual','campaign:'||p_id::text);
   end if;
  end if;
 end if;
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'campaign_'||p_action,jsonb_build_object('id',p_id,'before',previous,'after',p_value,'manual_payment',true));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.admin_campaign_decision(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_campaign_decision(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.public_paid_campaigns()
returns table(id uuid,business_id uuid,title text,description text,cover text,name text,category text)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.id,c.business_id,c.title,c.description,coalesce(nullif(c.image_url,''),nullif(b.cover_url,''),b.images->>0,nullif(b.logo_url,''),''),b.name,b.category
 from public.campaigns c join public.businesses b on b.id=c.business_id
 where c.status='approved' and c.payment_status='paid' and c.price>0 and c.start_date<=current_date and c.end_date>=current_date
 and b.approval_status='approved' and b.is_published
 order by c.created_at desc,c.id limit 100;
$$;
revoke all on function public.public_paid_campaigns() from public;
grant execute on function public.public_paid_campaigns() to anon,authenticated,service_role;

-- Quote checking and package lock run in a single transaction. Ownership and approval are explicit.
create or replace function public.submit_paid_campaign(p_business uuid,p_package uuid,p_title text,p_description text,p_image text,p_price numeric,p_days integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare pkg public.ad_packages; campaign_id uuid;
begin
 if not public.account_active() or public.account_role()<>'business' or not public.account_can_manage(p_business) or not exists(select 1 from public.business_account_approvals where user_id=auth.uid() and status='approved') then raise exception 'Onaylanmış yetkili işletme hesabı gerekli.' using errcode='42501'; end if;
 select * into pkg from public.ad_packages where id=p_package for share;
 if pkg.id is null or not pkg.active or pkg.type<>'content_campaign' or pkg.price<=0 or pkg.duration_days<1 then raise exception 'Yönetici henüz ücretli kampanya paketi tanımlamamış.' using errcode='22023'; end if;
 if p_price is distinct from pkg.price or p_days is distinct from pkg.duration_days then raise exception 'Paket fiyatı veya süresi değişti. Listeyi yenileyip yeni koşulları seçin.' using errcode='40001'; end if;
 insert into public.campaigns(business_id,package_id,title,description,image_url,price,publication_days)
 values(p_business,p_package,p_title,nullif(btrim(p_description),''),p_image,pkg.price,pkg.duration_days) returning id into campaign_id;
 return campaign_id;
end; $$;
revoke all on function public.submit_paid_campaign(uuid,uuid,text,text,text,numeric,integer) from public,anon;
grant execute on function public.submit_paid_campaign(uuid,uuid,text,text,text,numeric,integer) to authenticated;
create index if not exists campaigns_paid_ticker_idx on public.campaigns(start_date,end_date,created_at) where status='approved' and payment_status='paid' and price>0;
notify pgrst,'reload schema';
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261020_university_messages.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','university_messages',''),
   ('index','university_messages_author_idx',''),
   ('index','university_messages_pkey',''),
   ('index','university_messages_status_created_idx',''),
   ('policy','university_messages.authenticated_select_own_university_messages',''),
   ('column','university_messages.created_at',''),
   ('column','university_messages.decided_at',''),
   ('column','university_messages.decided_by',''),
   ('column','university_messages.id',''),
   ('column','university_messages.moderation_reason',''),
   ('column','university_messages.published_at',''),
   ('column','university_messages.status',''),
   ('column','university_messages.text',''),
   ('column','university_messages.user_id',''),
   ('function','university_public_messages()','5d41b12110d62a2fce7647f789dfc51b,9ed5826f6cacb4d64716b47c79b5862c'),
   ('function','submit_university_message(p_text text)','7b16e9cccbc846aec3aab9179f945dba,b338353d335b00960e888128119ef75b'),
   ('function','moderate_university_message(p_admin uuid, p_id uuid, p_status text, p_expected text, p_reason text)','b162ef8ae3bf5bf43dae1bc651a81efe')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261020_university_messages.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261020_university_messages.sql';
    execute $mig$-- Add university LED messages and administrator moderation without changing existing accounts or records.
-- (begin; kaldırıldı)
create table if not exists public.university_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 text text not null check (char_length(text) between 4 and 160),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 moderation_reason text check (char_length(moderation_reason)<=300),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 decided_at timestamptz,
 decided_by uuid references public.user_profiles(id) on delete set null
);
alter table public.university_messages enable row level security;
create index if not exists university_messages_status_created_idx on public.university_messages(status,created_at,id);
create index if not exists university_messages_author_idx on public.university_messages(user_id,created_at);
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='university_messages' and policyname='authenticated_select_own_university_messages') then
 -- Customers can see their own requests, including rejection feedback; no client mutation policies.
 create policy authenticated_select_own_university_messages on public.university_messages for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
revoke all on public.university_messages from anon,authenticated;
grant select on public.university_messages to authenticated;
grant all on public.university_messages to service_role;

-- The public projection exposes no author identifiers, private profiles or moderation details.
create or replace function public.university_public_messages()
returns table(id uuid,text text,published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select m.id,m.text,m.published_at from public.university_messages m
 join public.user_profiles p on p.id=m.user_id
 join auth.users u on u.id=p.id
 where m.status='approved' and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
 order by m.published_at asc,m.id asc;
$$;
revoke all on function public.university_public_messages() from public;
grant execute on function public.university_public_messages() to anon,authenticated,service_role;

create or replace function public.submit_university_message(p_text text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); content text; message_id uuid;
begin
 if actor is null or not public.account_customer() then
  raise exception 'Yazı göndermek için aktif bir kullanıcı hesabıyla giriş yapmalısınız.' using errcode='42501';
 end if;
 content:=btrim(regexp_replace(regexp_replace(coalesce(p_text,''),'[[:cntrl:]]',' ','g'),'[[:space:]]+',' ','g'));
 if char_length(content)<4 or char_length(content)>160 then raise exception 'Yazınız 4–160 karakter arasında olmalıdır.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':university-message',0));
 if exists(select 1 from public.university_messages where user_id=actor and created_at>now()-interval '60 seconds') then
  raise exception 'Yeni bir yazı göndermeden önce bir dakika bekleyin.' using errcode='22023';
 end if;
 if (select count(*) from public.university_messages where user_id=actor and status='pending')>=3 then
  raise exception 'En fazla üç yazınız onay bekleyebilir. Önce mevcut taleplerinizin değerlendirilmesini bekleyin.' using errcode='22023';
 end if;
 insert into public.university_messages(user_id,text) values(actor,content) returning id into message_id;
 insert into public.admin_alerts(type,ref_id,title,body) values('university_message',message_id,'Üniversiteden: yeni yazı isteği',left(content,160));
 return message_id;
end; $$;
revoke all on function public.submit_university_message(text) from public,anon;
grant execute on function public.submit_university_message(text) to authenticated;

-- Called only by the existing JWT-verified admin-api; decisions and audit are atomic.
create or replace function public.moderate_university_message(p_admin uuid,p_id uuid,p_status text,p_expected text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare previous text; reason text:=nullif(btrim(p_reason),'');
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
  where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com'
  and (p.restricted_until is null or p.restricted_until<=now()) and u.email_confirmed_at is not null and u.deleted_at is null
  and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('approved','rejected') or p_expected is null or p_expected not in ('pending','approved','rejected') or char_length(coalesce(reason,''))>300 then
  raise exception 'Geçersiz yayın kararı.' using errcode='22023';
 end if;
 select status into previous from public.university_messages where id=p_id for update;
 if previous is null then raise exception 'Yazı bulunamadı.' using errcode='22023'; end if;
 if previous<>p_expected then raise exception 'Yazının durumu değişti. Listeyi yenileyin.' using errcode='40001'; end if;
 update public.university_messages set status=p_status, moderation_reason=case when p_status='rejected' then reason else null end,
 published_at=case when p_status='approved' then coalesce(published_at,now()) else null end,
 decided_at=now(),decided_by=p_admin where id=p_id;
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'moderate_university_message',jsonb_build_object('id',p_id,'before',previous,'after',p_status));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.moderate_university_message(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.moderate_university_message(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261021_cadde_tv.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','public_cadde_tv_channels()','fd08dcb53ee4650a55ca01f9219b37fd,9b769ee8694c285bfafdd5f3c9a0568a')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261021_cadde_tv.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261021_cadde_tv.sql';
    execute $mig$-- Cadde TV: safe public projection of existing approved media.
-- Existing records, RLS, prices, accounts and legacy identifiers are preserved.
create or replace function public.public_cadde_tv_channels()
returns table(id uuid,business_id uuid,business_name text,category text,image_url text,caption text,sponsored boolean,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select channel.id,channel.business_id,b.name,b.category,channel.image_url,channel.caption,channel.sponsored,channel.created_at
 from (
  select p.id,p.business_id,p.image_url,coalesce(p.caption,'') as caption,false as sponsored,p.created_at
  from public.business_posts p
  where p.kind='reel' and p.status='approved' and nullif(btrim(p.image_url),'') is not null
   and (p.start_date is null or p.start_date<=current_date) and (p.end_date is null or p.end_date>=current_date)
  union all
  select a.id,a.business_id,a.image_url,coalesce(a.title,''),true,a.created_at
  from public.ads a
  where a.type='reels_sponsored' and a.status='active' and a.payment_status='paid'
   and nullif(btrim(a.image_url),'') is not null
   and a.start_date<=current_date and a.end_date>=current_date
 ) channel join public.businesses b on b.id=channel.business_id
 where b.approval_status='approved' and b.is_published
 order by channel.sponsored desc,channel.created_at desc,channel.id limit 120;
$$;
revoke all on function public.public_cadde_tv_channels() from public;
grant execute on function public.public_cadde_tv_channels() to anon,authenticated,service_role;
comment on function public.public_cadde_tv_channels() is 'Cadde TV public media only; no owner, contact, payment details or pending content.';
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261021_cadde_tv_broadcast_timezone.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','public_cadde_tv_channels()','9b769ee8694c285bfafdd5f3c9a0568a')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261021_cadde_tv_broadcast_timezone.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261021_cadde_tv_broadcast_timezone.sql';
    execute $mig$-- Cadde TV publication fix: use Turkey's broadcast day rather than the database timezone.
-- Only the public read projection is replaced; records, decisions, RLS and privileges stay intact.
create or replace function public.public_cadde_tv_channels()
returns table(id uuid,business_id uuid,business_name text,category text,image_url text,caption text,sponsored boolean,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 with broadcast as (select (now() at time zone 'Europe/Istanbul')::date as today)
 select channel.id,channel.business_id,b.name,b.category,channel.image_url,channel.caption,channel.sponsored,channel.created_at
 from (
  select p.id,p.business_id,p.image_url,coalesce(p.caption,'') as caption,false as sponsored,p.created_at
  from public.business_posts p cross join broadcast d
  where p.kind='reel' and p.status='approved' and nullif(btrim(p.image_url),'') is not null
   and (p.price<=0 or p.payment_status='paid')
   and (p.start_date is null or p.start_date<=d.today) and (p.end_date is null or p.end_date>=d.today)
  union all
  select a.id,a.business_id,a.image_url,coalesce(a.title,''),true,a.created_at
  from public.ads a cross join broadcast d
  where a.type='reels_sponsored' and a.status='active' and a.payment_status='paid'
   and nullif(btrim(a.image_url),'') is not null
   and a.start_date<=d.today and a.end_date>=d.today
 ) channel join public.businesses b on b.id=channel.business_id
 where b.approval_status='approved' and b.is_published
 order by channel.sponsored desc,channel.created_at desc,channel.id limit 120;
$$;
revoke all on function public.public_cadde_tv_channels() from public;
grant execute on function public.public_cadde_tv_channels() to anon,authenticated,service_role;
comment on function public.public_cadde_tv_channels() is 'Cadde TV: Europe/Istanbul broadcast dates, approved businesses and verified payment for paid media; no private fields.';
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261022_menu_product_search.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('index','menu_items_business_price_search_idx',''),
   ('function','discovery_search_text(p_text text)','40b1240ce99663f3b41da8c49b7c6320'),
   ('function','public_menu_search(p_query text, p_main text, p_sub text, p_open_ids uuid[], p_offset integer, p_limit integer)','8c90478e0b74b8b8c6b728a90f290839')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261022_menu_product_search.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261022_menu_product_search.sql';
    execute $mig$-- Public product/service name lookup for Discovery; no existing user data or policies are changed.
-- (begin; kaldırıldı)
create or replace function public.discovery_search_text(p_text text)
returns text language sql immutable parallel safe set search_path=public,pg_temp as $$
 select lower(translate(btrim(coalesce(p_text,'')), 'ÇĞİÖŞÜçğıöşü', 'CGIOSUcgiosu'));
$$;
revoke all on function public.discovery_search_text(text) from public;
grant execute on function public.discovery_search_text(text) to anon,authenticated,service_role;

create or replace function public.public_menu_search(p_query text, p_main text default 'yeme_icme', p_sub text default 'all', p_open_ids uuid[] default null, p_offset integer default 0, p_limit integer default 40)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with input as (
  select public.discovery_search_text(left(coalesce(p_query,''),200)) as query,
   greatest(0,coalesce(p_offset,0)) as skip, least(40,greatest(1,coalesce(p_limit,40))) as size
 ), published as (
  select b.id,b.name,
   case b.category when 'bar' then 'eglence' when 'club' then 'eglence' when 'berber' then 'erkek_kuafor'
    when 'guzellik_salonu' then 'guzellik' when 'protez_tirnak' then 'guzellik' when 'cilt_bakimi' then 'guzellik'
    when 'kas_kirpik' then 'guzellik' when 'makyaj' then 'guzellik' when 'agda_epilasyon' then 'guzellik' else b.category end as category
  from public.businesses b
  where b.approval_status='approved' and b.is_published and b.allow_menu
   and (p_open_ids is null or b.id=any(p_open_ids))
 ), matches as materialized (
  select m.id as item_id,m.business_id,b.name as business_name,b.category,m.name,m.price,m.description,m.image_url,m.group_name,m.duration_min
  from public.menu_items m join published b on b.id=m.business_id cross join input i
  where i.query<>'' and m.price>=0
   and (p_sub='all' or b.category=p_sub)
   and ((p_main='yeme_icme' and b.category in ('restoran','kafe','market','eglence'))
     or (p_main='guzellik_bakim' and b.category in ('kadin_kuafor','erkek_kuafor','guzellik')))
   and not exists (
    select 1 from regexp_split_to_table(i.query,'[[:space:]]+') as token
    where token<>'' and strpos(public.discovery_search_text(m.name),token)=0
   )
 ), page as materialized (
  select * from matches order by price asc,item_id asc
  offset (select skip from input) limit (select size from input)
 ), stats as (
  select public.business_star_stats(coalesce(array_agg(distinct business_id),array[]::uuid[])) as votes from page
 )
 select jsonb_build_object('total',(select count(*) from matches),'items',coalesce((
  select jsonb_agg(to_jsonb(p)||jsonb_build_object(
   'rating',coalesce(s.votes->p.business_id::text->'rating','0'::jsonb),
   'rating_count',coalesce(s.votes->p.business_id::text->'count','0'::jsonb)
  ) order by p.price asc,p.item_id asc) from page p cross join stats s
 ),'[]'::jsonb));
$$;
comment on function public.public_menu_search(text,text,text,uuid[],integer,integer) is 'Public, paginated menu/product/service search ordered by actual price ascending; only published approved businesses with visible menus and aggregate star votes are exposed.';
revoke all on function public.public_menu_search(text,text,text,uuid[],integer,integer) from public;
grant execute on function public.public_menu_search(text,text,text,uuid[],integer,integer) to anon,authenticated,service_role;
create index if not exists menu_items_business_price_search_idx on public.menu_items(business_id,price,id);
notify pgrst,'reload schema';
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261022_university_withdrawal.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('trigger','university_withdrawal_guard',''),
   ('column','university_messages.withdrawn_at',''),
   ('column','university_messages.withdrawn_by',''),
   ('function','university_public_messages()','9ed5826f6cacb4d64716b47c79b5862c'),
   ('function','withdraw_university_message(p_id uuid)','acde007927b356dd373ecd00ba7b577f'),
   ('function','university_withdrawal_guard()','ddf3792b9e42217812250503018b591f'),
   ('function','submit_university_message(p_text text)','b338353d335b00960e888128119ef75b')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261022_university_withdrawal.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261022_university_withdrawal.sql';
    execute $mig$-- Add withdrawal support to university_messages; preserve existing rows, decisions and RLS.
-- (begin; kaldırıldı)
alter table public.university_messages add column if not exists withdrawn_at timestamptz;
alter table public.university_messages add column if not exists withdrawn_by uuid references public.user_profiles(id) on delete set null;
comment on column public.university_messages.withdrawn_at is 'Removed from the TV feed by the author or authorized administrator; historical row is retained.';

create or replace function public.withdraw_university_message(p_id uuid)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); item public.university_messages; administrator boolean; withdrawn timestamptz;
begin
 if actor is null then raise exception 'Yazı kaldırmak için giriş yapmalısınız.' using errcode='42501'; end if;
 administrator:=public.account_admin();
 select * into item from public.university_messages where id=p_id and (user_id=actor or administrator) for update;
 if not found then raise exception 'Yazı bulunamadı veya kaldırma yetkiniz yok.' using errcode='42501'; end if;
 if item.withdrawn_at is not null then return item.withdrawn_at; end if;
 withdrawn:=now();
 update public.university_messages set withdrawn_at=withdrawn,withdrawn_by=actor where id=item.id;
 if administrator then
  insert into public.admin_logs(admin_id,action,detail) values(actor,'withdraw_university_message',jsonb_build_object('id',item.id,'previous_status',item.status));
 end if;
 return withdrawn;
end; $$;
revoke all on function public.withdraw_university_message(uuid) from public,anon;
grant execute on function public.withdraw_university_message(uuid) to authenticated;

-- Serialize moderation/removal on the same row and prevent resurrection of withdrawn content.
create or replace function public.university_withdrawal_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.withdrawn_at is not null and (new.withdrawn_at is distinct from old.withdrawn_at or (new.withdrawn_by is distinct from old.withdrawn_by and new.withdrawn_by is not null) or new.status is distinct from old.status or new.text is distinct from old.text) then
  raise exception 'Kaldırılan yazı tekrar yayınlanamaz. Yeni bir yazı isteği gönderilmelidir.' using errcode='40001';
 end if;
 return new;
end; $$;
revoke all on function public.university_withdrawal_guard() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.university_messages'::regclass and tgname='university_withdrawal_guard') then
  create trigger university_withdrawal_guard before update on public.university_messages for each row execute function public.university_withdrawal_guard();
 end if;
end; $$;

create or replace function public.university_public_messages()
returns table(id uuid,text text,published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select m.id,m.text,m.published_at from public.university_messages m
 join public.user_profiles p on p.id=m.user_id
 join auth.users u on u.id=p.id
 where m.status='approved' and m.withdrawn_at is null and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
 order by m.published_at asc,m.id asc;
$$;
revoke all on function public.university_public_messages() from public;
grant execute on function public.university_public_messages() to anon,authenticated,service_role;

-- Keep validation and anti-spam throttle. Withdrawn pending requests no longer occupy quota.
create or replace function public.submit_university_message(p_text text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); content text; message_id uuid;
begin
 if actor is null or not public.account_customer() then
  raise exception 'Yazı göndermek için aktif bir kullanıcı hesabıyla giriş yapmalısınız.' using errcode='42501';
 end if;
 content:=btrim(regexp_replace(regexp_replace(coalesce(p_text,''),'[[:cntrl:]]',' ','g'),'[[:space:]]+',' ','g'));
 if char_length(content)<4 or char_length(content)>160 then raise exception 'Yazınız 4–160 karakter arasında olmalıdır.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':university-message',0));
 if exists(select 1 from public.university_messages where user_id=actor and created_at>now()-interval '60 seconds') then
  raise exception 'Yeni bir yazı göndermeden önce bir dakika bekleyin.' using errcode='22023';
 end if;
 if (select count(*) from public.university_messages where user_id=actor and status='pending' and withdrawn_at is null)>=3 then
  raise exception 'En fazla üç yazınız onay bekleyebilir. Önce mevcut taleplerinizin değerlendirilmesini bekleyin.' using errcode='22023';
 end if;
 insert into public.university_messages(user_id,text) values(actor,content) returning id into message_id;
 insert into public.admin_alerts(type,ref_id,title,body) values('university_message',message_id,'Üniversiteden: yeni yazı isteği',left(content,160));
 return message_id;
end; $$;
revoke all on function public.submit_university_message(text) from public,anon;
grant execute on function public.submit_university_message(text) to authenticated;
notify pgrst,'reload schema';
-- (commit; kaldırıldı)
$mig$;
  end if;
end
$catchup$;

-- 20261023_cafe_photo_privacy.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','cafe_profile_photos',''),
   ('table','cafe_rooms',''),
   ('table','cafe_visits',''),
   ('index','cafe_profile_photos_pkey',''),
   ('index','cafe_rooms_pkey',''),
   ('index','cafe_visits_pkey',''),
   ('index','cafe_visits_room_expiry_idx',''),
   ('policy','cafe_profile_photos.authenticated_select_own_cafe_photo',''),
   ('policy','cafe_visits.authenticated_select_own_cafe_visit',''),
   ('column','cafe_profile_photos.path',''),
   ('column','cafe_profile_photos.updated_at',''),
   ('column','cafe_profile_photos.user_id',''),
   ('column','cafe_rooms.business_id',''),
   ('column','cafe_rooms.enabled',''),
   ('column','cafe_rooms.updated_at',''),
   ('column','cafe_visits.business_id',''),
   ('column','cafe_visits.expires_at',''),
   ('column','cafe_visits.joined_at',''),
   ('column','cafe_visits.photo_visible',''),
   ('column','cafe_visits.user_id',''),
   ('function','cafe_leave()','067e6b3c609934b19b06cad5b03018ef'),
   ('function','cafe_save_photo(p_path text)','2767623944a56a51b15a60f93f02304a'),
   ('function','cafe_photo_allowed(p_path text)','a8c165e466b59fa693d36b7ee93ed064,e099abfd4c0c368681ae774e55c560eb,c07559d5bc70daa225856aab25f963c6,5826685db84d542eaa6ac74c1b3f4fe2'),
   ('function','cafe_room_live(p_business uuid)','d8a0d814f192942035c68a850fbdab86,20cd31fdce97932f553e90a8397e436d,a52af1d8e4639a7e188074d31d230571'),
   ('function','cafe_customer_live(p_user uuid)','170641e9c5cef75f59611ab8b4fa2c26'),
   ('function','cafe_my_visit()','abb8459d84c4632843bb6ae018ca75d5,4a78e198fd53a3bcf3aed9619434c874,81b144615b352416c527cf460da3bcf1'),
   ('function','cafe_set_room(p_business uuid, p_enabled boolean)','946c806258dde16ff78c3553fbdbc64a,19b51449a1364946b550768f1a96dc3d,9b44ef6a9f0b3bde1c1abf72c7157dbe'),
   ('function','cafe_join(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone, p_visible boolean)','878ae479e01ef8aa39ec84f3fde8e4ba,6df0dfea4676d6afcfe8261c2d8de451,11aa00bbd056e3ea734943d9d968de62,d9c9dea8a0bc082cde2211da00355824,b1172c59b2999348ee5031b7457e78e6,605a06ef1425ad9c8bc2257803a55f93'),
   ('function','cafe_set_visibility(p_visible boolean)','7c3828da65f72eb8ef071a371386fa42,fb279dfc83e249f8dce987078da33a87'),
   ('function','cafe_room_state(p_business uuid)','9cb536de9ee0a5cff91585cb9ce3a48f,67c4274bf41bcc7578b46cc7a1ae841a,c900cb9bb3ad6a8615680ce22fa72c26,5bf222e001cb84c1644a2fec5aca557c,df816f0da83233e06a21125ad8b10473')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261023_cafe_photo_privacy.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261023_cafe_photo_privacy.sql';
    execute $mig$-- Cafe visit photo privacy: opt-in rooms, short-lived visits and private photo storage.
-- Additive only: existing profiles, account roles and business permissions are unchanged.
-- (begin; kaldırıldı)
create table if not exists public.cafe_rooms (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.cafe_visits (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 photo_visible boolean not null default false,
 joined_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create table if not exists public.cafe_profile_photos (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 path text not null,
 updated_at timestamptz not null default now(),
 constraint cafe_photo_owned_path check(split_part(path,'/',1)=user_id::text and path ~ '^[0-9a-f-]+/[0-9a-f-]+\.jpg$')
);
alter table public.cafe_rooms enable row level security;
alter table public.cafe_visits enable row level security;
alter table public.cafe_profile_photos enable row level security;
revoke all on public.cafe_rooms,public.cafe_visits,public.cafe_profile_photos from anon,authenticated;
grant select on public.cafe_visits,public.cafe_profile_photos to authenticated;
grant all on public.cafe_rooms,public.cafe_visits,public.cafe_profile_photos to service_role;
create index if not exists cafe_visits_room_expiry_idx on public.cafe_visits(business_id,expires_at);
-- Direct reads expose only the caller's own private visit/photo, never other profiles.
create policy authenticated_select_own_cafe_visit on public.cafe_visits for select to authenticated using(user_id=auth.uid());
create policy authenticated_select_own_cafe_photo on public.cafe_profile_photos for select to authenticated using(user_id=auth.uid());
create or replace function public.cafe_room_live(p_business uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cafe_rooms r join public.businesses b on b.id=r.business_id where r.business_id=p_business and r.enabled and b.category='kafe' and b.approval_status='approved' and b.is_published);
$$;
create or replace function public.cafe_customer_live(p_user uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles p where p.id=p_user and p.role='user' and p.status='active' and (p.restricted_until is null or p.restricted_until<=now()) and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id));
$$;
create or replace function public.cafe_my_visit() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select (select jsonb_build_object('business_id',v.business_id,'business_name',b.name,'photo_visible',v.photo_visible,'expires_at',v.expires_at) from public.cafe_visits v join public.businesses b on b.id=v.business_id where v.user_id=auth.uid() and v.expires_at>now() and public.cafe_customer_live(v.user_id) and public.cafe_room_live(v.business_id));
$$;
create or replace function public.cafe_set_room(p_business uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_can_manage(p_business),false) then raise exception 'İşletme yönetim yetkisi gerekli.' using errcode='42501'; end if;
 if p_enabled is null or not exists(select 1 from public.businesses where id=p_business and category='kafe' and (not p_enabled or (lat is not null and lng is not null))) then raise exception 'Önce kafe kategorisini ve işletme konumunu kaydedin.' using errcode='22023'; end if;
 insert into public.cafe_rooms(business_id,enabled) values(p_business,p_enabled) on conflict(business_id) do update set enabled=excluded.enabled,updated_at=now();
 -- Disabling ends existing visits; reopening never republishes previous consent.
 if not p_enabled then update public.cafe_visits set expires_at=now(),photo_visible=false where business_id=p_business; end if;
 return jsonb_build_object('enabled',p_enabled);
end; $$;
create or replace function public.cafe_join(p_business uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz,p_visible boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare b_lat double precision; b_lng double precision; d double precision;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabıyla giriş yapın.' using errcode='42501'; end if;
 if not public.cafe_room_live(p_business) then raise exception 'Bu kafe katılımı açmamış.' using errcode='42501'; end if;
 if p_visible is null or p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 60) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve yeterince hassas konum gerekli. Yeniden deneyin.' using errcode='22023'; end if;
 select lat,lng into b_lat,b_lng from public.businesses where id=p_business;
 if b_lat is null or b_lng is null then raise exception 'İşletme konumu eksik.' using errcode='22023'; end if;
 d:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-b_lat)/2),2)+cos(radians(b_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-b_lng)/2),2))));
 if d>100 then raise exception 'Katılmak için kafenin yakınında olmalısınız (100 m).' using errcode='42501'; end if;
 -- Store no precise customer coordinates. One live cafe per customer.
 insert into public.cafe_visits(user_id,business_id,photo_visible,expires_at) values(auth.uid(),p_business,p_visible,now()+interval '5 minutes') on conflict(user_id) do update set business_id=excluded.business_id,photo_visible=excluded.photo_visible,joined_at=case when cafe_visits.business_id=excluded.business_id and cafe_visits.expires_at>now() then cafe_visits.joined_at else now() end,expires_at=excluded.expires_at;
 return public.cafe_my_visit();
end; $$;
create or replace function public.cafe_set_visibility(p_visible boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_visible is null or not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 update public.cafe_visits set photo_visible=p_visible where user_id=auth.uid() and expires_at>now() and public.cafe_room_live(business_id);
 if not found then raise exception 'Kafeye yeniden katılın.' using errcode='22023'; end if;
 return public.cafe_my_visit();
end; $$;
create or replace function public.cafe_leave() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
 update public.cafe_visits set photo_visible=false,expires_at=now() where user_id=auth.uid();
end; $$;
create or replace function public.cafe_photo_allowed(p_path text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.account_active(),false) and (
 split_part(p_path,'/',1)=auth.uid()::text or exists(
 select 1 from public.cafe_profile_photos p join public.cafe_visits target on target.user_id=p.user_id join public.cafe_visits viewer on viewer.business_id=target.business_id
 where p.path=p_path and target.photo_visible and target.expires_at>now() and viewer.user_id=auth.uid() and viewer.expires_at>now() and public.cafe_customer_live(target.user_id) and public.cafe_customer_live(viewer.user_id) and public.cafe_room_live(target.business_id)));
$$;
create or replace function public.cafe_save_photo(p_path text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_active(),false) or p_path is null or split_part(p_path,'/',1)<>auth.uid()::text or p_path !~ '^[0-9a-f-]+/[0-9a-f-]+\.jpg$' then raise exception 'Fotoğraf yolu geçersiz.' using errcode='42501'; end if;
 if not exists(select 1 from storage.objects where bucket_id='cafe-profile-photos' and name=p_path) then raise exception 'Önce fotoğrafı yükleyin.' using errcode='22023'; end if;
 insert into public.cafe_profile_photos(user_id,path) values(auth.uid(),p_path) on conflict(user_id) do update set path=excluded.path,updated_at=now();
end; $$;
create or replace function public.cafe_room_state(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare mine jsonb; enabled boolean; peers jsonb:='[]'::jsonb; total integer:=0;
begin
 enabled:=public.cafe_room_live(p_business);
 if coalesce(public.account_can_manage(p_business),false) then
 return jsonb_build_object('enabled',coalesce((select r.enabled from public.cafe_rooms r where r.business_id=p_business),false),'mine',null,'members',peers,'count',0);
 end if;
 mine:=public.cafe_my_visit();
 if enabled then select count(*) into total from public.cafe_visits v where v.business_id=p_business and v.expires_at>now() and public.cafe_customer_live(v.user_id); end if;
 if enabled and mine->>'business_id'=p_business::text then
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into peers from (
 select v.user_id,coalesce(nullif(p.first_name,''),'Katılımcı') as name,ph.path as photo_path from public.cafe_visits v join public.user_profiles p on p.id=v.user_id join public.cafe_profile_photos ph on ph.user_id=v.user_id
 where v.business_id=p_business and v.user_id<>auth.uid() and v.photo_visible and v.expires_at>now() and public.cafe_customer_live(v.user_id) order by v.joined_at desc limit 50) x;
 end if;
 return jsonb_build_object('enabled',enabled,'mine',case when mine->>'business_id'=p_business::text then mine else null end,'count',total,'members',peers);
end; $$;
-- Internal helpers cannot be invoked directly by clients.
revoke all on function public.cafe_room_live(uuid),public.cafe_customer_live(uuid) from public,anon,authenticated;
revoke all on function public.cafe_my_visit(),public.cafe_set_room(uuid,boolean),public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean),public.cafe_set_visibility(boolean),public.cafe_leave(),public.cafe_save_photo(text),public.cafe_photo_allowed(text),public.cafe_room_state(uuid) from public,anon,authenticated;
grant execute on function public.cafe_my_visit(),public.cafe_set_room(uuid,boolean),public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean),public.cafe_set_visibility(boolean),public.cafe_leave(),public.cafe_save_photo(text),public.cafe_photo_allowed(text),public.cafe_room_state(uuid) to authenticated;
grant execute on function public.cafe_room_state(uuid) to anon;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cafe-profile-photos','cafe-profile-photos',false,1048576,array['image/jpeg']) on conflict(id) do nothing;
-- No public reads or signed public avatar URLs. Every download rechecks live cafe consent.
create policy authenticated_select_authorized_cafe_photo on storage.objects for select to authenticated using(bucket_id='cafe-profile-photos' and public.cafe_photo_allowed(name));
create policy authenticated_insert_own_cafe_photo on storage.objects for insert to authenticated with check(bucket_id='cafe-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.account_active());
create policy authenticated_update_own_cafe_photo on storage.objects for update to authenticated using(bucket_id='cafe-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.account_active()) with check(bucket_id='cafe-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.account_active());
create policy authenticated_delete_own_cafe_photo on storage.objects for delete to authenticated using(bucket_id='cafe-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.account_active());
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261023_content_order_messages.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','media_cleanup_queue',''),
   ('table','order_messages',''),
   ('index','media_cleanup_queue_path_key',''),
   ('index','media_cleanup_queue_pkey',''),
   ('index','order_messages_pkey',''),
   ('index','order_messages_unread_idx',''),
   ('trigger','order_delivery_transition_guard',''),
   ('trigger','order_message_guard',''),
   ('trigger','publish_order_message',''),
   ('policy','business_posts.anon_select_live_post_media',''),
   ('policy','business_posts.authenticated_select_live_post_media',''),
   ('policy','order_messages.authenticated_select_own_order_messages',''),
   ('policy','order_messages.authenticated_update_own_order_messages',''),
   ('column','ads.media_removed_at',''),
   ('column','business_posts.media_removed_at',''),
   ('column','campaigns.media_removed_at',''),
   ('column','media_cleanup_queue.attempts',''),
   ('column','media_cleanup_queue.business_id',''),
   ('column','media_cleanup_queue.completed_at',''),
   ('column','media_cleanup_queue.created_at',''),
   ('column','media_cleanup_queue.id',''),
   ('column','media_cleanup_queue.last_error',''),
   ('column','media_cleanup_queue.path',''),
   ('column','order_messages.business_name',''),
   ('column','order_messages.created_at',''),
   ('column','order_messages.id',''),
   ('column','order_messages.order_id',''),
   ('column','order_messages.read_at',''),
   ('column','order_messages.status',''),
   ('column','order_messages.user_id',''),
   ('function','account_request_guard()','672a9ee32708bd5b11d961f468a77df9'),
   ('function','creative_is_referenced(p_url text)','b0dabbb6c66c50bb26364a2b051ad203'),
   ('function','order_message_guard()','3cd1b43f302d8491b0128f8de330d9d5'),
   ('function','order_delivery_transition_guard()','2997be986c174705b90d0d4261e22869'),
   ('function','publish_order_message()','7018af5a44e013c92be62c39c298c566'),
   ('function','public_complaint_email()','7e7d02b09e054f6efd2ff2b132904a73')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261023_content_order_messages.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261023_content_order_messages.sql';
    execute $mig$-- Additive order delivery messages, complaint target and creative cleanup queue.
-- No existing user records are updated/deleted and no historical messages are backfilled.
-- (begin; kaldırıldı)
create table if not exists public.order_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 business_name text not null, status text not null,
 created_at timestamptz not null default now(), read_at timestamptz
);
alter table public.order_messages enable row level security;
create index if not exists order_messages_unread_idx on public.order_messages(user_id,created_at) where read_at is null;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_messages' and policyname='authenticated_select_own_order_messages') then
  create policy authenticated_select_own_order_messages on public.order_messages for select to authenticated using(user_id=auth.uid());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_messages' and policyname='authenticated_update_own_order_messages') then
  create policy authenticated_update_own_order_messages on public.order_messages for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 end if;
end; $$;
revoke all on public.order_messages from anon,authenticated;
grant select,update(read_at) on public.order_messages to authenticated;
grant all on public.order_messages to service_role;
create or replace function public.order_message_guard() returns trigger language plpgsql as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='authenticated' then
  if (to_jsonb(new)-'read_at') is distinct from (to_jsonb(old)-'read_at') then raise exception 'Yalnızca mesaj okundu bilgisi değiştirilebilir.' using errcode='42501'; end if;
  new.read_at:=now();
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.order_messages'::regclass and tgname='order_message_guard') then
  create trigger order_message_guard before update on public.order_messages for each row execute function public.order_message_guard();
 end if;
end; $$;
-- Change only the allowed status list in the existing comprehensive identity/price guard.
do $$ declare definition text; begin
 select pg_get_functiondef('public.account_request_guard()'::regprocedure) into definition;
 definition:=replace(definition,'''pending'',''approved'',''rejected'',''delivered''','''pending'',''approved'',''rejected'',''on_the_way'',''delivered''');
 execute definition;
end; $$;
create or replace function public.order_delivery_transition_guard() returns trigger language plpgsql as $$
begin
 if new.status is not distinct from old.status then return new; end if;
 if not ((old.status='pending' and new.status in ('approved','rejected'))
 or (old.status='rejected' and new.status='approved')
 or (old.status='approved' and new.status in ('on_the_way','rejected'))
 or (old.status='on_the_way' and new.status='delivered')) then
  raise exception 'Sipariş durumu değişmiş veya geçiş uygun değil. Önce onaylayın, sonra yola çıktı ve teslim edildi adımlarını izleyin.' using errcode='22023';
 end if;
 return new;
end; $$;
create or replace function public.publish_order_message() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  insert into public.order_messages(user_id,order_id,business_name,status)
  values(new.user_id,new.id,coalesce((select name from public.businesses where id=new.business_id),'İşletme'),new.status);
 end if;
 return new;
end; $$;
revoke all on function public.publish_order_message() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='order_delivery_transition_guard') then
  create trigger order_delivery_transition_guard before update on public.orders for each row execute function public.order_delivery_transition_guard();
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='publish_order_message') then
  create trigger publish_order_message after insert or update on public.orders for each row execute function public.publish_order_message();
 end if;
end; $$;
alter table public.business_posts add column if not exists media_removed_at timestamptz;
alter table public.ads add column if not exists media_removed_at timestamptz;
alter table public.campaigns add column if not exists media_removed_at timestamptz;
create table if not exists public.media_cleanup_queue (
 id uuid primary key default gen_random_uuid(),path text not null unique,
 business_id uuid references public.businesses(id) on delete set null,
 created_at timestamptz not null default now(),completed_at timestamptz,
 attempts integer not null default 0,last_error text
);
alter table public.media_cleanup_queue enable row level security;
-- System maintenance data has no public/customer access; service-role only.
revoke all on public.media_cleanup_queue from anon,authenticated;
grant all on public.media_cleanup_queue to service_role;
create or replace function public.public_complaint_email() returns text language sql stable security definer set search_path=public,pg_temp as $$
 select value from public.app_config where key='complaint_email' and value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
$$;
revoke all on function public.public_complaint_email() from public;
grant execute on function public.public_complaint_email() to anon,authenticated,service_role;
-- Enforce expiry even on raw table reads; managers retain moderation access.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_posts' and policyname='anon_select_live_post_media') then
  create policy anon_select_live_post_media on public.business_posts as restrictive for select to anon
   using(nullif(btrim(image_url),'') is not null and (start_date is null or start_date<=(now() at time zone 'Europe/Istanbul')::date) and (end_date is null or end_date>=(now() at time zone 'Europe/Istanbul')::date));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_posts' and policyname='authenticated_select_live_post_media') then
  create policy authenticated_select_live_post_media on public.business_posts as restrictive for select to authenticated
   using(public.account_can_manage(business_id) or (nullif(btrim(image_url),'') is not null and (start_date is null or start_date<=(now() at time zone 'Europe/Istanbul')::date) and (end_date is null or end_date>=(now() at time zone 'Europe/Istanbul')::date)));
 end if;
end; $$;
-- Check references across all businesses, not only the original upload owner.
create or replace function public.creative_is_referenced(p_url text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.business_posts where image_url=p_url)
 or exists(select 1 from public.ads where image_url=p_url)
 or exists(select 1 from public.campaigns where image_url=p_url)
 or exists(select 1 from public.menu_items where image_url=p_url)
 or exists(select 1 from public.businesses b where b.logo_url=p_url or b.cover_url=p_url or b.menu_cover_url=p_url
  or b.images @> jsonb_build_array(p_url)
  or exists(select 1 from jsonb_each_text(case when jsonb_typeof(b.menu_group_covers)='object' then b.menu_group_covers else '{}'::jsonb end) cover where cover.value=p_url));
$$;
revoke all on function public.creative_is_referenced(text) from public,anon,authenticated;
grant execute on function public.creative_is_referenced(text) to service_role;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
-- No server cron is installed: this Cloud database cannot enable pg_cron.
-- Physical expiry cleanup runs via media-maintenance on active app startup/foreground/60s polling.
$mig$;
  end if;
end
$catchup$;

-- 20261023_next_open_order_ratings.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','order_rating_receipts',''),
   ('index','order_messages_delivered_rating_idx',''),
   ('index','order_rating_receipts_pkey',''),
   ('policy','order_rating_receipts.authenticated_select_own_order_rating_receipts',''),
   ('column','order_rating_receipts.business_id',''),
   ('column','order_rating_receipts.order_id',''),
   ('column','order_rating_receipts.rated_at',''),
   ('column','order_rating_receipts.rating',''),
   ('column','order_rating_receipts.user_id',''),
   ('function','pending_order_ratings(p_opened_before timestamp with time zone)','1cd8fa6efdc7f46526dd9a3ece0aac7d'),
   ('function','submit_order_business_rating(p_user uuid, p_order uuid, p_rating numeric)','0db1c34e1a0a97099eaaf1ca96083e41')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261023_next_open_order_ratings.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261023_next_open_order_ratings.sql';
    execute $mig$-- Next-open business rating prompts: private receipts, delivered-event lookup and atomic star submission.
-- Existing orders, rating aggregates, delivery guards and account permissions remain unchanged.
-- (begin; kaldırıldı)
create table if not exists public.order_rating_receipts (
 order_id uuid primary key references public.orders(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 rating numeric(2,1) not null check(rating between 0.5 and 5 and rating*2=trunc(rating*2)),
 rated_at timestamptz not null default now()
);
alter table public.order_rating_receipts enable row level security;
revoke all on public.order_rating_receipts from anon,authenticated;
grant select on public.order_rating_receipts to authenticated;
grant all on public.order_rating_receipts to service_role;
comment on table public.order_rating_receipts is 'Private per-order completion receipts; stars still use one vote per customer/business.';
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_rating_receipts' and policyname='authenticated_select_own_order_rating_receipts') then
 -- Customers may only read their own completion receipts; no direct client writes.
 create policy authenticated_select_own_order_rating_receipts on public.order_rating_receipts for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
create index if not exists order_messages_delivered_rating_idx on public.order_messages(user_id,created_at desc,order_id) where status='delivered';
create or replace function public.pending_order_ratings(p_opened_before timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gereklidir.' using errcode='42501'; end if;
 if p_opened_before is null then raise exception 'Uygulama açılış zamanı gereklidir.' using errcode='22023'; end if;
 with delivered as (
 select m.order_id,max(m.created_at) as delivered_at from public.order_messages m
 where m.user_id=auth.uid() and m.status='delivered'
 group by m.order_id
 ), eligible as (
 select o.id as order_id,o.business_id,b.name as business_name,d.delivered_at,r.rating as mine
 from delivered d join public.orders o on o.id=d.order_id
 join public.businesses b on b.id=o.business_id
 left join public.business_star_ratings r on r.business_id=o.business_id and r.user_id=auth.uid()
 where o.user_id=auth.uid() and o.status='delivered'
 and d.delivered_at<least(p_opened_before,now())
 and b.approval_status='approved' and b.is_published and b.owner_id is distinct from auth.uid()
 and not exists(select 1 from public.order_rating_receipts receipt where receipt.order_id=o.id)
 -- A business rating already submitted after this delivery needs no second reminder.
 and (r.updated_at is null or r.updated_at<d.delivered_at)
 order by d.delivered_at desc,o.id limit 10
 )
 select coalesce(jsonb_agg(to_jsonb(e) order by e.delivered_at desc,e.order_id),'[]'::jsonb) into result from eligible e;
 return result;
end; $$;
revoke all on function public.pending_order_ratings(timestamptz) from public,anon;
grant execute on function public.pending_order_ratings(timestamptz) to authenticated;
-- Only rating-api may supply the customer ID, after verifying the JWT and email.
create or replace function public.submit_order_business_rating(p_user uuid,p_order uuid,p_rating numeric) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_business uuid; delivery_at timestamptz;
begin
 if p_rating is null or p_rating not between 0.5 and 5 or p_rating*2<>trunc(p_rating*2) then raise exception '0,5–5 arasında yarım yıldız puanı seçin.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,20261020));
 if not exists(select 1 from public.user_profiles p where p.id=p_user and p.role='user' and p.status='active' and (p.restricted_until is null or p.restricted_until<=now()))
 or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'Aktif müşteri hesabı gereklidir.' using errcode='42501'; end if;
 select o.business_id into target_business from public.orders o where o.id=p_order and o.user_id=p_user and o.status='delivered' for share;
 if target_business is null then raise exception 'Yalnızca size ait teslim edilmiş siparişi değerlendirebilirsiniz.' using errcode='42501'; end if;
 -- Retries after a lost response are idempotent and never add another vote.
 if exists(select 1 from public.order_rating_receipts where order_id=p_order and user_id=p_user) then return jsonb_build_object('ok',true); end if;
 select max(created_at) into delivery_at from public.order_messages where order_id=p_order and user_id=p_user and status='delivered';
 if delivery_at is null then raise exception 'Siparişin teslim bilgisi doğrulanamadı.' using errcode='42501'; end if;
 -- Reuse all existing ownership, publication, half-star and rate-limit checks.
 perform public.submit_business_star(p_user,target_business,p_rating);
 insert into public.order_rating_receipts(order_id,user_id,business_id,rating) values(p_order,p_user,target_business,p_rating);
 -- Acknowledgement is committed with the vote and receipt, never before a successful vote.
 update public.order_messages set read_at=now() where user_id=p_user and order_id=p_order and created_at<=delivery_at and read_at is null;
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.submit_order_business_rating(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.submit_order_business_rating(uuid,uuid,numeric) to service_role;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';$mig$;
  end if;
end
$catchup$;

-- 20261023_order_reports.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('index','orders_business_created_report_idx',''),
   ('index','orders_created_report_idx',''),
   ('function','order_report_data(p_owner uuid, p_start date, p_end date, p_business uuid, p_status text, p_sort text, p_view text, p_page integer)','2c0125eb3a5b675bc5d9cb6d08a9845f'),
   ('function','business_order_report(p_start date, p_end date, p_business uuid, p_status text, p_sort text, p_view text, p_page integer)','8b565a57ef0e3bcae67cb5520c81ef89'),
   ('function','admin_order_report(p_admin uuid, p_start date, p_end date, p_business uuid, p_status text, p_sort text, p_view text, p_page integer)','43d66aa128aa96a7f19b6bf697e49153')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261023_order_reports.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261023_order_reports.sql';
    execute $mig$-- Private paginated order histories and complete Istanbul-day revenue aggregates.
-- Existing orders, status guards, account permissions and payment ledgers are unchanged.
-- (begin; kaldırıldı)
create index if not exists orders_business_created_report_idx on public.orders(business_id,created_at desc,id);
create index if not exists orders_created_report_idx on public.orders(created_at desc,id);

-- Internal projection: only trusted wrappers may choose the ownership scope.
create or replace function public.order_report_data(
 p_owner uuid, p_start date, p_end date, p_business uuid, p_status text,
 p_sort text, p_view text, p_page integer
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_status is null or p_status not in ('all','pending','approved','on_the_way','delivered','rejected')
 or p_sort is null or p_sort not in ('newest','oldest','highest','lowest')
 or p_view is null or p_view not in ('orders','daily')
 or p_page is null or p_page < 0 or p_page > 1000000
 or (p_start is not null and p_end is not null and p_start > p_end) then
  raise exception 'Geçersiz sipariş raporu filtresi.' using errcode='22023';
 end if;
 with scoped as materialized (
  select o.*,b.name as business_name from public.orders o join public.businesses b on b.id=o.business_id
  where (p_owner is null or b.owner_id=p_owner)
   and (p_business is null or o.business_id=p_business)
   and (p_start is null or o.created_at >= (p_start::timestamp at time zone 'Europe/Istanbul'))
   and (p_end is null or o.created_at < ((p_end+1)::timestamp at time zone 'Europe/Istanbul'))
   and (p_status='all' or o.status=p_status)
 ), daily as (
  select (created_at at time zone 'Europe/Istanbul')::date as day,
   count(*) as order_count, count(*) filter(where status='delivered') as delivered_count,
   coalesce(sum(total) filter(where status='delivered'),0) as revenue
  from scoped group by 1
 ), order_page as (
  select s.*,row_number() over(order by
   case when p_sort='newest' then created_at end desc,
   case when p_sort='oldest' then created_at end asc,
   case when p_sort='highest' then total end desc,
   case when p_sort='lowest' then total end asc,created_at desc,id) as ordinal
  from scoped s where p_view='orders'
  order by ordinal limit 30 offset (p_page::bigint*30)
 ), day_page as (
  select d.*,row_number() over(order by
   case when p_sort='newest' then day end desc,
   case when p_sort='oldest' then day end asc,
   case when p_sort='highest' then revenue end desc,
   case when p_sort='lowest' then revenue end asc,day desc) as ordinal
  from daily d where p_view='daily'
  order by ordinal limit 30 offset (p_page::bigint*30)
 )
 select jsonb_build_object(
  'orders',coalesce((select jsonb_agg((to_jsonb(o)-'business_name'-'ordinal') || jsonb_build_object('businesses',jsonb_build_object('name',o.business_name)) order by ordinal) from order_page o),'[]'::jsonb),
  'days',coalesce((select jsonb_agg(to_jsonb(d)-'ordinal' order by ordinal) from day_page d),'[]'::jsonb),
  'totalRows',case when p_view='daily' then (select count(*) from daily) else (select count(*) from scoped) end,
  'page',p_page,'pageSize',30,
  'summary',(select jsonb_build_object('orderCount',count(*),'deliveredCount',count(*) filter(where status='delivered'),
   'revenue',coalesce(sum(total) filter(where status='delivered'),0),
   'average',coalesce(round(avg(total) filter(where status='delivered'),2),0)) from scoped),
  'businesses',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name,b.id) from public.businesses b where p_owner is null or b.owner_id=p_owner),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.order_report_data(uuid,date,date,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.order_report_data(uuid,date,date,uuid,text,text,text,integer) to service_role;

-- Businesses can only report on their own orders, after account approval.
create or replace function public.business_order_report(
 p_start date default null,p_end date default null,p_business uuid default null,
 p_status text default 'all',p_sort text default 'newest',p_view text default 'orders',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not coalesce(public.account_active(),false) or public.account_role() is distinct from 'business' then
  raise exception 'Onaylı işletme hesabı gereklidir.' using errcode='42501';
 end if;
 return public.order_report_data(auth.uid(),p_start,p_end,p_business,p_status,p_sort,p_view,p_page);
end; $$;
revoke all on function public.business_order_report(date,date,uuid,text,text,text,integer) from public,anon;
grant execute on function public.business_order_report(date,date,uuid,text,text,text,integer) to authenticated;

-- Admin access goes through the existing JWT-verified admin-api; never a client-supplied actor.
create or replace function public.admin_order_report(
 p_admin uuid,p_start date default null,p_end date default null,p_business uuid default null,
 p_status text default 'all',p_sort text default 'newest',p_view text default 'orders',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.user_profiles p where p.id=p_admin and p.role='admin' and p.status='active'
  and lower(btrim(p.email))='caddeden.app@gmail.com'
  and (p.restricted_until is null or p.restricted_until<=now())
  and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gereklidir.' using errcode='42501';
 end if;
 return public.order_report_data(null,p_start,p_end,p_business,p_status,p_sort,p_view,p_page);
end; $$;
revoke all on function public.admin_order_report(uuid,date,date,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_order_report(uuid,date,date,uuid,text,text,text,integer) to service_role;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261024_cafe_seating_social.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','cafe_instagram_requests',''),
   ('table','cafe_social_profiles',''),
   ('table','cafe_tables',''),
   ('index','cafe_instagram_cooldown_idx',''),
   ('index','cafe_instagram_inbox_idx',''),
   ('index','cafe_instagram_requests_pkey',''),
   ('index','cafe_instagram_requests_requester_id_recipient_id_key',''),
   ('index','cafe_social_profiles_pkey',''),
   ('index','cafe_tables_business_id_grid_x_grid_y_key',''),
   ('index','cafe_tables_pkey',''),
   ('policy','cafe_social_profiles.authenticated_select_own_cafe_social',''),
   ('column','cafe_instagram_requests.blocked_until',''),
   ('column','cafe_instagram_requests.business_id',''),
   ('column','cafe_instagram_requests.decided_at',''),
   ('column','cafe_instagram_requests.id',''),
   ('column','cafe_instagram_requests.recipient_id',''),
   ('column','cafe_instagram_requests.requested_at',''),
   ('column','cafe_instagram_requests.requester_id',''),
   ('column','cafe_instagram_requests.status',''),
   ('column','cafe_rooms.occupancy_enabled',''),
   ('column','cafe_social_profiles.instagram_handle',''),
   ('column','cafe_social_profiles.updated_at',''),
   ('column','cafe_social_profiles.user_id',''),
   ('column','cafe_tables.business_id',''),
   ('column','cafe_tables.grid_x',''),
   ('column','cafe_tables.grid_y',''),
   ('column','cafe_tables.id',''),
   ('column','cafe_tables.label',''),
   ('column','cafe_tables.seats',''),
   ('function','cafe_room_state(p_business uuid)','67c4274bf41bcc7578b46cc7a1ae841a,c900cb9bb3ad6a8615680ce22fa72c26,5bf222e001cb84c1644a2fec5aca557c,df816f0da83233e06a21125ad8b10473'),
   ('function','cafe_photo_allowed(p_path text)','e099abfd4c0c368681ae774e55c560eb,c07559d5bc70daa225856aab25f963c6,5826685db84d542eaa6ac74c1b3f4fe2'),
   ('function','cafe_photo_blocked(p_viewer uuid, p_target uuid)','7c394c19cbf93d7c8d1ba0b5cd96cdc0,cad3ca063a78d661806d9be5892d7ebd'),
   ('function','cafe_pair_live(p_viewer uuid, p_target uuid)','0a99448711300806f218659790755e24'),
   ('function','cafe_set_instagram(p_handle text)','c0944906b0858d3694b8fc06e1d7aca8'),
   ('function','cafe_request_instagram(p_target uuid)','2a7cbaa83c955b79aff13e10c16682c1,580908a08cf999e6822f0bcdf010710d,64c682e21b7ddd6ee03a7f3d39c635a5'),
   ('function','cafe_decide_instagram(p_request uuid, p_accept boolean)','dc296266e07e8bb10670884284702b45,87d952c7a0351bd6ddc4898a68c86923,d921254faed3bace3520da4492cde874'),
   ('function','cafe_instagram_link(p_request uuid)','5d07a2757fad74d5c7f6142432284c65,9ebd8a6e84f5796b8c2dac0a5f7125c9,f7d284cc9fd098a6c53b464936538906'),
   ('function','cafe_social_state()','b934aed06152a00b5f179e924bc8e8c5,53372848e6df81dcc4ebd84b1570dd44,d78888c06c8b2b724288b1f9f0f9e095,7468439abe67ac71aafb66026b6f80b2'),
   ('function','cafe_save_seating(p_business uuid, p_enabled boolean, p_tables jsonb)','7b466934716aadaa6e24f5382ba1d2ee,731c55617aea97e32871cd076991e4b5')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261024_cafe_seating_social.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261024_cafe_seating_social.sql';
    execute $mig$-- Add optional cafe table plans, participant-based estimates and private Instagram consent.
-- Additive schema; no migration changes existing user records or cafe participation choices.
-- (begin; kaldırıldı)
alter table public.cafe_rooms add column if not exists occupancy_enabled boolean not null default false;
create table if not exists public.cafe_tables (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 label text not null check(char_length(label) between 1 and 24),
 seats integer not null check(seats between 1 and 12),
 grid_x integer not null check(grid_x between 0 and 5),
 grid_y integer not null check(grid_y between 0 and 9),
 unique(business_id,grid_x,grid_y)
);
create table if not exists public.cafe_social_profiles (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 instagram_handle text not null check(instagram_handle ~ '^[A-Za-z0-9_][A-Za-z0-9_.]{0,29}$'),
 updated_at timestamptz not null default now()
);
create table if not exists public.cafe_instagram_requests (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 requester_id uuid not null references public.user_profiles(id) on delete cascade,
 recipient_id uuid not null references public.user_profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 requested_at timestamptz not null default now(),
 decided_at timestamptz,
 blocked_until timestamptz,
 unique(requester_id,recipient_id),
 check(requester_id<>recipient_id)
);
alter table public.cafe_tables enable row level security;
alter table public.cafe_social_profiles enable row level security;
alter table public.cafe_instagram_requests enable row level security;
revoke all on public.cafe_tables,public.cafe_social_profiles,public.cafe_instagram_requests from anon,authenticated;
grant select on public.cafe_social_profiles to authenticated;
grant all on public.cafe_tables,public.cafe_social_profiles,public.cafe_instagram_requests to service_role;
-- Only the owner can read the saved handle directly; no public profile/social joins.
create policy authenticated_select_own_cafe_social on public.cafe_social_profiles for select to authenticated using(user_id=auth.uid());
create index if not exists cafe_instagram_inbox_idx on public.cafe_instagram_requests(recipient_id,status,requested_at desc);
create index if not exists cafe_instagram_cooldown_idx on public.cafe_instagram_requests(requester_id,recipient_id,blocked_until);

create or replace function public.cafe_pair_live(p_viewer uuid,p_target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select p_viewer<>p_target and public.cafe_customer_live(p_viewer) and public.cafe_customer_live(p_target) and exists(
 select 1 from public.cafe_visits v join public.cafe_visits t on t.business_id=v.business_id
 where v.user_id=p_viewer and t.user_id=p_target and v.expires_at>now() and t.expires_at>now() and public.cafe_room_live(v.business_id));
$$;
create or replace function public.cafe_photo_blocked(p_viewer uuid,p_target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cafe_instagram_requests where requester_id=p_viewer and recipient_id=p_target and blocked_until>now());
$$;
create or replace function public.cafe_photo_allowed(p_path text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.account_active(),false) and (
 split_part(p_path,'/',1)=auth.uid()::text or exists(
 select 1 from public.cafe_profile_photos p join public.cafe_visits target on target.user_id=p.user_id join public.cafe_visits viewer on viewer.business_id=target.business_id
 where p.path=p_path and target.photo_visible and target.expires_at>now() and viewer.user_id=auth.uid() and viewer.expires_at>now()
 and public.cafe_customer_live(target.user_id) and public.cafe_customer_live(viewer.user_id) and public.cafe_room_live(target.business_id)
 and not public.cafe_photo_blocked(viewer.user_id,target.user_id)));
$$;
create or replace function public.cafe_set_instagram(p_handle text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 if p_handle is null or p_handle !~ '^[A-Za-z0-9_][A-Za-z0-9_.]{0,29}$' then raise exception 'Geçerli bir Instagram kullanıcı adı girin.' using errcode='22023'; end if;
 insert into public.cafe_social_profiles(user_id,instagram_handle) values(auth.uid(),p_handle)
 on conflict(user_id) do update set instagram_handle=excluded.instagram_handle,updated_at=now();
end; $$;
create or replace function public.cafe_request_instagram(p_target uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_request public.cafe_instagram_requests; room_id uuid;
begin
 if auth.uid() is null or not coalesce(public.cafe_pair_live(auth.uid(),p_target),false) then raise exception 'İstek için aynı kafede aktif katılım gerekli.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_target::text,20261024));
 if public.cafe_photo_blocked(auth.uid(),p_target) then raise exception 'Bu kişiye 3 günlük gizlilik süresi bitmeden yeniden istek gönderilemez.' using errcode='42501'; end if;
 if not exists(select 1 from public.cafe_visits v join public.cafe_profile_photos p on p.user_id=v.user_id where v.user_id=p_target and public.cafe_photo_allowed(p.path)) then raise exception 'Bu profil şu anda görünür değil.' using errcode='42501'; end if;
 if not exists(select 1 from public.cafe_social_profiles where user_id=p_target) then raise exception 'Bu kişi Instagram kullanıcı adı eklememiş.' using errcode='22023'; end if;
 select * into current_request from public.cafe_instagram_requests where requester_id=auth.uid() and recipient_id=p_target;
 if current_request.status in ('pending','accepted') then return jsonb_build_object('id',current_request.id,'status',current_request.status); end if;
 if (select count(*) from public.cafe_instagram_requests where requester_id=auth.uid() and requested_at>now()-interval '1 hour')>=10 then raise exception 'Saatlik istek sınırına ulaştınız. Daha sonra deneyin.' using errcode='42501'; end if;
 select business_id into room_id from public.cafe_visits where user_id=auth.uid();
 insert into public.cafe_instagram_requests(business_id,requester_id,recipient_id) values(room_id,auth.uid(),p_target)
 on conflict(requester_id,recipient_id) do update set business_id=excluded.business_id,status='pending',requested_at=now(),decided_at=null,blocked_until=null
 returning * into current_request;
 return jsonb_build_object('id',current_request.id,'status',current_request.status);
end; $$;
create or replace function public.cafe_decide_instagram(p_request uuid,p_accept boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.cafe_instagram_requests;
begin
 if not coalesce(public.account_customer(),false) or p_accept is null then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select * into r from public.cafe_instagram_requests where id=p_request and recipient_id=auth.uid() for update;
 if not found then raise exception 'Bu isteği yönetemezsiniz.' using errcode='42501'; end if;
 if p_accept and r.status='accepted' then return; end if;
 if not p_accept and r.status='rejected' then return; end if;
 if p_accept and (r.status<>'pending' or not public.cafe_pair_live(r.requester_id,r.recipient_id) or not exists(select 1 from public.cafe_social_profiles where user_id=auth.uid())) then raise exception 'Onay için aynı kafede aktif katılım ve Instagram kullanıcı adı gerekli.' using errcode='42501'; end if;
 update public.cafe_instagram_requests set status=case when p_accept then 'accepted' else 'rejected' end,decided_at=now(),blocked_until=case when p_accept then null else now()+interval '3 days' end where id=r.id;
end; $$;
create or replace function public.cafe_instagram_link(p_request uuid) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare handle text;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select p.instagram_handle into handle from public.cafe_instagram_requests r join public.cafe_social_profiles p on p.user_id=r.recipient_id
 where r.id=p_request and r.requester_id=auth.uid() and r.status='accepted' and public.cafe_pair_live(r.requester_id,r.recipient_id) and not public.cafe_photo_blocked(r.requester_id,r.recipient_id);
 if handle is null then raise exception 'Instagram erişimi için karşı tarafın onayı ve aynı kafede aktif katılım gerekli.' using errcode='42501'; end if;
 return 'https://www.instagram.com/'||handle||'/';
end; $$;
create or replace function public.cafe_social_state() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare incoming jsonb; outgoing jsonb;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into incoming from (
 select r.id,r.requester_id as user_id,coalesce(nullif(p.first_name,''),'Katılımcı') as name,r.status,r.requested_at,r.blocked_until,
 public.cafe_pair_live(r.requester_id,r.recipient_id) as can_accept,
 case when public.cafe_photo_allowed(ph.path) then ph.path else null end as photo_path
 from public.cafe_instagram_requests r join public.user_profiles p on p.id=r.requester_id left join public.cafe_profile_photos ph on ph.user_id=p.id
 where r.recipient_id=auth.uid() and r.status in ('pending','accepted') and public.cafe_customer_live(r.requester_id) order by r.requested_at desc limit 50) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into outgoing from (
 select r.id,r.recipient_id as user_id,r.status,r.blocked_until from public.cafe_instagram_requests r where r.requester_id=auth.uid() order by r.requested_at desc limit 100) x;
 return jsonb_build_object('incoming',incoming,'outgoing',outgoing);
end; $$;

create or replace function public.cafe_save_seating(p_business uuid,p_enabled boolean,p_tables jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare t jsonb;
begin
 if not coalesce(public.account_can_manage(p_business),false) then raise exception 'İşletme yönetim yetkisi gerekli.' using errcode='42501'; end if;
 if not exists(select 1 from public.businesses where id=p_business and category='kafe') then raise exception 'Masa planı yalnızca kafeler içindir.' using errcode='22023'; end if;
 if p_enabled is null or p_tables is null or jsonb_typeof(p_tables)<>'array' then raise exception 'Masa planı geçersiz.' using errcode='22023'; end if;
 if jsonb_array_length(p_tables)>60 or (p_enabled and jsonb_array_length(p_tables)=0) then raise exception 'Gösterim için 1–60 masa ekleyin.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,20261024));
 for t in select value from jsonb_array_elements(p_tables) loop
 if t->>'id' is null or t->>'label' is null or char_length(btrim(t->>'label')) not between 1 and 24 or t->>'seats' is null or (t->>'seats')::integer not between 1 and 12 or t->>'grid_x' is null or (t->>'grid_x')::integer not between 0 and 5 or t->>'grid_y' is null or (t->>'grid_y')::integer not between 0 and 9 then raise exception 'Masa adı, kapasitesi veya konumu geçersiz.' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_tables) t group by t->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_tables) t group by t->>'grid_x',t->>'grid_y' having count(*)>1) then raise exception 'Her masa için farklı konum seçin.' using errcode='22023'; end if;
 if exists(select 1 from public.cafe_tables ct join jsonb_array_elements(p_tables) t on ct.id=(t->>'id')::uuid where ct.business_id<>p_business) then raise exception 'Başka kafenin masasını düzenleyemezsiniz.' using errcode='42501'; end if;
 -- User-initiated plan replacement is atomic and never deletes visits or photos.
 delete from public.cafe_tables where business_id=p_business;
 insert into public.cafe_tables(id,business_id,label,seats,grid_x,grid_y) select (t->>'id')::uuid,p_business,btrim(t->>'label'),(t->>'seats')::integer,(t->>'grid_x')::integer,(t->>'grid_y')::integer from jsonb_array_elements(p_tables) t;
 insert into public.cafe_rooms(business_id,enabled,occupancy_enabled) values(p_business,false,p_enabled)
 on conflict(business_id) do update set occupancy_enabled=excluded.occupancy_enabled,updated_at=now();
end; $$;
create or replace function public.cafe_room_state(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare mine jsonb; enabled boolean; peers jsonb:='[]'::jsonb; total integer:=0; plan jsonb:='[]'::jsonb; capacity integer:=0; show_plan boolean:=false; manager boolean; published boolean;
begin
 enabled:=public.cafe_room_live(p_business); manager:=coalesce(public.account_can_manage(p_business),false);
 published:=exists(select 1 from public.businesses where id=p_business and category='kafe' and approval_status='approved' and is_published);
 if not published and not manager then return jsonb_build_object('enabled',false,'mine',null,'members',peers,'count',0,'tables',plan,'occupancy_enabled',false,'capacity',0); end if;
 show_plan:=coalesce((select occupancy_enabled from public.cafe_rooms where business_id=p_business),false);
 if show_plan or manager then
 select coalesce(jsonb_agg(to_jsonb(t) order by t.grid_y,t.grid_x),'[]'::jsonb),coalesce(sum(t.seats),0)::integer into plan,capacity from (select id,label,seats,grid_x,grid_y from public.cafe_tables where business_id=p_business) t;
 end if;
 if enabled then select count(*) into total from public.cafe_visits v where v.business_id=p_business and v.expires_at>now() and public.cafe_customer_live(v.user_id); end if;
 mine:=public.cafe_my_visit();
 if enabled and mine->>'business_id'=p_business::text then
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into peers from (
 select v.user_id,coalesce(nullif(p.first_name,''),'Katılımcı') as name,ph.path as photo_path,
 exists(select 1 from public.cafe_social_profiles sp where sp.user_id=v.user_id) as has_instagram,
 (select r.status from public.cafe_instagram_requests r where r.requester_id=auth.uid() and r.recipient_id=v.user_id) as request_status,
 (select r.id from public.cafe_instagram_requests r where r.requester_id=auth.uid() and r.recipient_id=v.user_id) as request_id
 from public.cafe_visits v join public.user_profiles p on p.id=v.user_id join public.cafe_profile_photos ph on ph.user_id=v.user_id
 where v.business_id=p_business and v.user_id<>auth.uid() and v.photo_visible and v.expires_at>now() and public.cafe_customer_live(v.user_id) and not public.cafe_photo_blocked(auth.uid(),v.user_id) order by v.joined_at desc limit 50) x;
 end if;
 return jsonb_build_object('enabled',case when manager then coalesce((select r.enabled from public.cafe_rooms r where r.business_id=p_business),false) else enabled end,'mine',case when mine->>'business_id'=p_business::text then mine else null end,'count',total,'members',peers,'tables',plan,'occupancy_enabled',show_plan,'capacity',capacity);
end; $$;
revoke all on function public.cafe_pair_live(uuid,uuid),public.cafe_photo_blocked(uuid,uuid) from public,anon,authenticated;
revoke all on function public.cafe_set_instagram(text),public.cafe_request_instagram(uuid),public.cafe_decide_instagram(uuid,boolean),public.cafe_instagram_link(uuid),public.cafe_social_state(),public.cafe_save_seating(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.cafe_set_instagram(text),public.cafe_request_instagram(uuid),public.cafe_decide_instagram(uuid,boolean),public.cafe_instagram_link(uuid),public.cafe_social_state(),public.cafe_save_seating(uuid,boolean,jsonb) to authenticated;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261024_cafe_venue_page.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','cafe_my_visit()','4a78e198fd53a3bcf3aed9619434c874,81b144615b352416c527cf460da3bcf1'),
   ('function','cafe_venue_live(p_business uuid)','8200f89a93a45519f61f36cd21bb8a03,ffc8cd21fb908cb3cf88dbb6a68aef69,158e4e02fb71fb1615a1e67e88f8d5ba'),
   ('function','cafe_join(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone, p_visible boolean)','6df0dfea4676d6afcfe8261c2d8de451,11aa00bbd056e3ea734943d9d968de62,d9c9dea8a0bc082cde2211da00355824,b1172c59b2999348ee5031b7457e78e6,605a06ef1425ad9c8bc2257803a55f93'),
   ('function','cafe_room_state(p_business uuid)','c900cb9bb3ad6a8615680ce22fa72c26,5bf222e001cb84c1644a2fec5aca557c,df816f0da83233e06a21125ad8b10473')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261024_cafe_venue_page.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261024_cafe_venue_page.sql';
    execute $mig$-- Venue-page seating is local-only; aggregate occupancy remains visible on the venue page.
-- No customer records, seating plans, photos or existing consent decisions are modified.
-- (begin; kaldırıldı)
create or replace function public.cafe_venue_live(p_business uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cafe_rooms r join public.businesses b on b.id=r.business_id
 where r.business_id=p_business and (r.enabled or r.occupancy_enabled) and b.category='kafe'
 and b.approval_status='approved' and b.is_published and b.lat is not null and b.lng is not null);
$$;
create or replace function public.cafe_my_visit() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select (select jsonb_build_object('business_id',v.business_id,'business_name',b.name,
 'photo_visible',v.photo_visible and public.cafe_room_live(v.business_id),
 'social_enabled',public.cafe_room_live(v.business_id),'expires_at',v.expires_at)
 from public.cafe_visits v join public.businesses b on b.id=v.business_id
 where v.user_id=auth.uid() and v.expires_at>now() and public.cafe_customer_live(v.user_id)
 and public.cafe_venue_live(v.business_id));
$$;
create or replace function public.cafe_join(p_business uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz,p_visible boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare b_lat double precision; b_lng double precision; d double precision;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabıyla giriş yapın.' using errcode='42501'; end if;
 if not public.cafe_venue_live(p_business) then raise exception 'Mekân konumla katılımı açmamış veya işletme konumu eksik.' using errcode='42501'; end if;
 if p_visible is null or p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 60) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve yeterince hassas konum gerekli. Yeniden deneyin.' using errcode='22023'; end if;
 select lat,lng into b_lat,b_lng from public.businesses where id=p_business;
 if b_lat is null or b_lng is null then raise exception 'İşletme konumu eksik.' using errcode='22023'; end if;
 d:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-b_lat)/2),2)+cos(radians(b_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-b_lng)/2),2))));
 if d>100 then raise exception 'Masa düzeni ve katılım için mekânın yakınında olmalısınız (100 m).' using errcode='42501'; end if;
 -- Seating-only entry never enables photo sharing or Instagram access.
 insert into public.cafe_visits(user_id,business_id,photo_visible,expires_at)
 values(auth.uid(),p_business,p_visible and public.cafe_room_live(p_business),now()+interval '5 minutes')
 on conflict(user_id) do update set business_id=excluded.business_id,photo_visible=excluded.photo_visible,
 joined_at=case when cafe_visits.business_id=excluded.business_id and cafe_visits.expires_at>now() then cafe_visits.joined_at else now() end,expires_at=excluded.expires_at;
 return public.cafe_my_visit();
end; $$;
create or replace function public.cafe_room_state(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare mine jsonb; enabled boolean; participation boolean; local_visit boolean:=false;
 peers jsonb:='[]'::jsonb; total integer:=0; plan jsonb:='[]'::jsonb; capacity integer:=0;
 show_plan boolean:=false; manager boolean; published boolean; plan_visible boolean:=false;
begin
 enabled:=public.cafe_room_live(p_business); participation:=public.cafe_venue_live(p_business);
 manager:=coalesce(public.account_can_manage(p_business),false);
 published:=exists(select 1 from public.businesses where id=p_business and category='kafe' and approval_status='approved' and is_published);
 if not published and not manager then
  return jsonb_build_object('enabled',false,'participation_enabled',false,'mine',null,'members',peers,'count',0,'tables',plan,'occupancy_enabled',false,'capacity',0,'plan_visible',false);
 end if;
 mine:=public.cafe_my_visit();
 local_visit:=coalesce(mine->>'business_id'=p_business::text,false);
 show_plan:=coalesce((select occupancy_enabled from public.cafe_rooms where business_id=p_business),false);
 -- Aggregate capacity is public when the owner enables it. Table positions require a live location-verified visit.
 if show_plan or manager then select coalesce(sum(seats),0)::integer into capacity from public.cafe_tables where business_id=p_business; end if;
 plan_visible:=manager or (show_plan and local_visit);
 if plan_visible then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.grid_y,t.grid_x),'[]'::jsonb) into plan
  from (select id,label,seats,grid_x,grid_y from public.cafe_tables where business_id=p_business) t;
 end if;
 if participation then select count(*) into total from public.cafe_visits v where v.business_id=p_business and v.expires_at>now() and public.cafe_customer_live(v.user_id); end if;
 -- Social participation remains independently controlled by the business, including seating-only rooms.
 if enabled and local_visit then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into peers from (
   select v.user_id,coalesce(nullif(p.first_name,''),'Katılımcı') as name,ph.path as photo_path,
   exists(select 1 from public.cafe_social_profiles sp where sp.user_id=v.user_id) as has_instagram,
   (select r.status from public.cafe_instagram_requests r where r.requester_id=auth.uid() and r.recipient_id=v.user_id) as request_status,
   (select r.id from public.cafe_instagram_requests r where r.requester_id=auth.uid() and r.recipient_id=v.user_id) as request_id
   from public.cafe_visits v join public.user_profiles p on p.id=v.user_id join public.cafe_profile_photos ph on ph.user_id=v.user_id
   where v.business_id=p_business and v.user_id<>auth.uid() and v.photo_visible and v.expires_at>now()
   and public.cafe_customer_live(v.user_id) and not public.cafe_photo_blocked(auth.uid(),v.user_id)
   order by v.joined_at desc limit 50) x;
 end if;
 return jsonb_build_object('enabled',case when manager then coalesce((select r.enabled from public.cafe_rooms r where r.business_id=p_business),false) else enabled end,
 'participation_enabled',participation,'mine',case when local_visit then mine else null end,'count',total,
 'members',peers,'tables',plan,'occupancy_enabled',show_plan,'capacity',capacity,'plan_visible',plan_visible);
end; $$;
-- The helper is internal; public access continues through the scoped overview only.
revoke all on function public.cafe_venue_live(uuid) from public,anon,authenticated;
revoke all on function public.cafe_my_visit(),public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean),public.cafe_room_state(uuid) from public,anon,authenticated;
grant execute on function public.cafe_my_visit(),public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean),public.cafe_room_state(uuid) to authenticated;
grant execute on function public.cafe_room_state(uuid) to anon;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261024_cafe_arrival_prompt.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','cafe_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','a57d152c22f85b72b263b2fa35d196e1,6977ead1bb443d2cc4d967ace4659d16,bd1f9aa4a93bc9d2f455d22fc5c70c3e,40cc01ee57d6d2bb32b94973bcbb3862,de6776b034285e751a970d62201f74e5'),
   ('function','cafe_join(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone, p_visible boolean)','11aa00bbd056e3ea734943d9d968de62,d9c9dea8a0bc082cde2211da00355824,b1172c59b2999348ee5031b7457e78e6,605a06ef1425ad9c8bc2257803a55f93')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261024_cafe_arrival_prompt.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261024_cafe_arrival_prompt.sql';
    execute $mig$-- Opt-in arrival suggestions and manual entry share a strict distance < 20 m gate.
-- No existing visits, businesses, photos or consent records are modified by this migration.
-- (begin; kaldırıldı)
create or replace function public.cafe_nearby(p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 if p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 20) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve hassas konum gerekli (en fazla 20 m hassasiyet).' using errcode='22023'; end if;
 -- Read-only suggestions: neither presence nor coordinates are stored here.
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.distance_meters,x.business_id),'[]'::jsonb) from (
  select b.id as business_id,b.name as business_name,public.cafe_room_live(b.id) as social_enabled,
   6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-b.lat)/2),2)+cos(radians(b.lat))*cos(radians(p_lat))*power(sin(radians(p_lng-b.lng)/2),2)))) as distance_meters
  from public.cafe_rooms r join public.businesses b on b.id=r.business_id
  where (r.enabled or r.occupancy_enabled) and b.category='kafe' and b.approval_status='approved' and b.is_published and b.lat is not null and b.lng is not null
 ) x where x.distance_meters<20);
end; $$;
create or replace function public.cafe_join(p_business uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz,p_visible boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare b_lat double precision; b_lng double precision; d double precision;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabıyla giriş yapın.' using errcode='42501'; end if;
 if not public.cafe_venue_live(p_business) then raise exception 'Mekân konumla katılımı açmamış veya işletme konumu eksik.' using errcode='42501'; end if;
 if p_visible is null or p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 20) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve hassas konum gerekli. Hassas konumu açın (en fazla 20 m hassasiyet).' using errcode='22023'; end if;
 select lat,lng into b_lat,b_lng from public.businesses where id=p_business;
 if b_lat is null or b_lng is null then raise exception 'İşletme konumu eksik.' using errcode='22023'; end if;
 d:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-b_lat)/2),2)+cos(radians(b_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-b_lng)/2),2))));
 if d>=20 then raise exception 'Burada olduğunuzu doğrulamak için işletmenin kayıtlı konumuna 20 metreden yakın olmalısınız.' using errcode='42501'; end if;
 -- A visit is written only after explicit confirmation; seating-only entries never share a photo.
 insert into public.cafe_visits(user_id,business_id,photo_visible,expires_at) values(auth.uid(),p_business,p_visible and public.cafe_room_live(p_business),now()+interval '5 minutes')
 on conflict(user_id) do update set business_id=excluded.business_id,photo_visible=excluded.photo_visible,joined_at=case when cafe_visits.business_id=excluded.business_id and cafe_visits.expires_at>now() then cafe_visits.joined_at else now() end,expires_at=excluded.expires_at;
 return public.cafe_my_visit();
end; $$;
-- Suggestions require an active customer. Anonymous callers cannot scan nearby rooms.
revoke all on function public.cafe_nearby(double precision,double precision,double precision,timestamptz) from public,anon,authenticated;
grant execute on function public.cafe_nearby(double precision,double precision,double precision,timestamptz) to authenticated;
revoke all on function public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean) to authenticated;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261024_venue_presence_40m_privacy.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','venue_profile_preferences',''),
   ('index','venue_profile_preferences_pkey',''),
   ('column','venue_profile_preferences.enabled',''),
   ('column','venue_profile_preferences.updated_at',''),
   ('column','venue_profile_preferences.user_id',''),
   ('function','cafe_set_visibility(p_visible boolean)','fb279dfc83e249f8dce987078da33a87'),
   ('function','cafe_photo_blocked(p_viewer uuid, p_target uuid)','cad3ca063a78d661806d9be5892d7ebd'),
   ('function','cafe_photo_allowed(p_path text)','c07559d5bc70daa225856aab25f963c6,5826685db84d542eaa6ac74c1b3f4fe2'),
   ('function','cafe_request_instagram(p_target uuid)','580908a08cf999e6822f0bcdf010710d,64c682e21b7ddd6ee03a7f3d39c635a5'),
   ('function','cafe_decide_instagram(p_request uuid, p_accept boolean)','87d952c7a0351bd6ddc4898a68c86923,d921254faed3bace3520da4492cde874'),
   ('function','cafe_instagram_link(p_request uuid)','9ebd8a6e84f5796b8c2dac0a5f7125c9,f7d284cc9fd098a6c53b464936538906'),
   ('function','cafe_save_seating(p_business uuid, p_enabled boolean, p_tables jsonb)','731c55617aea97e32871cd076991e4b5'),
   ('function','cafe_social_state()','53372848e6df81dcc4ebd84b1570dd44,d78888c06c8b2b724288b1f9f0f9e095,7468439abe67ac71aafb66026b6f80b2'),
   ('function','cafe_room_state(p_business uuid)','5bf222e001cb84c1644a2fec5aca557c,df816f0da83233e06a21125ad8b10473'),
   ('function','cafe_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','6977ead1bb443d2cc4d967ace4659d16,bd1f9aa4a93bc9d2f455d22fc5c70c3e,40cc01ee57d6d2bb32b94973bcbb3862,de6776b034285e751a970d62201f74e5'),
   ('function','venue_profile_enabled(p_user uuid)','3abe9663db5a062913b87bfd920a29c6'),
   ('function','cafe_join(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone, p_visible boolean)','d9c9dea8a0bc082cde2211da00355824,b1172c59b2999348ee5031b7457e78e6,605a06ef1425ad9c8bc2257803a55f93'),
   ('function','venue_masked_name(p_first text, p_last text)','a604a9c7b43f0d88f75ce313b40ed338'),
   ('function','venue_profile_preference()','3fc509cb9a5380a56fb1430adbb30e95'),
   ('function','set_venue_profile_preference(p_visible boolean)','426a33b2b794dc27fbbd77042c35b0c3'),
   ('function','cafe_save_seating_payload(p_business uuid, p_enabled boolean, p_plan text)','b6e2c59b64dfffe25c17106afcd55cda')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261024_venue_presence_40m_privacy.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261024_venue_presence_40m_privacy.sql';
    execute $mig$-- Venue participation: 40 m entry, seating transport repair, anonymous profiles and seven-day rejection privacy.
-- Schema/functions only; existing records, preferences and request history are not rewritten.
-- (begin; kaldırıldı)
create table if not exists public.venue_profile_preferences (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.venue_profile_preferences enable row level security;
revoke all on public.venue_profile_preferences from anon,authenticated;
grant all on public.venue_profile_preferences to service_role;
-- Private access is through authenticated RPCs only; no other customer's settings are readable.
create or replace function public.venue_profile_enabled(p_user uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select enabled from public.venue_profile_preferences where user_id=p_user),true);
$$;
create or replace function public.venue_profile_preference() returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 return public.venue_profile_enabled(auth.uid());
end; $$;
create or replace function public.set_venue_profile_preference(p_visible boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_visible is null or not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 insert into public.venue_profile_preferences(user_id,enabled) values(auth.uid(),p_visible) on conflict(user_id) do update set enabled=excluded.enabled,updated_at=now();
 if not p_visible then update public.cafe_visits set photo_visible=false where user_id=auth.uid(); end if;
end; $$;
create or replace function public.venue_masked_name(p_first text,p_last text) returns text language sql immutable set search_path=public,pg_temp as $$
 select coalesce(nullif(btrim(p_first),''),'Kullanıcı') || case when nullif(btrim(p_last),'') is null then '' else ' '||left(btrim(p_last),1)||'***' end;
$$;
create or replace function public.cafe_photo_blocked(p_viewer uuid,p_target uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cafe_instagram_requests r where r.requester_id=p_viewer and r.recipient_id=p_target and greatest(r.blocked_until,case when r.status='rejected' then r.decided_at+interval '7 days' end)>now());
$$;
create or replace function public.cafe_photo_allowed(p_path text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.account_active(),false) and (
 split_part(p_path,'/',1)=auth.uid()::text or exists(
 select 1 from public.cafe_profile_photos ph join public.cafe_visits target on target.user_id=ph.user_id join public.cafe_visits viewer on viewer.business_id=target.business_id
 where ph.path=p_path and target.photo_visible and public.venue_profile_enabled(target.user_id) and target.expires_at>now() and viewer.user_id=auth.uid() and viewer.expires_at>now()
 and public.cafe_customer_live(target.user_id) and public.cafe_customer_live(viewer.user_id) and public.cafe_room_live(target.business_id)
 and not public.cafe_photo_blocked(viewer.user_id,target.user_id)));
$$;
-- Both arrival scanning and manual confirmation retain the same accuracy/freshness checks.
do $$ declare signature text; definition text; begin
 foreach signature in array array['public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)','public.cafe_nearby(double precision,double precision,double precision,timestamptz)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'d>=20','d>=40');
  definition:=replace(definition,'x.distance_meters<20','x.distance_meters<40');
  definition:=replace(definition,'20 metreden yakın olmalısınız','40 metreden yakın olmalısınız');
  if signature like 'public.cafe_join%' then
   definition:=replace(definition,'p_visible and public.cafe_room_live(p_business)','p_visible and public.cafe_room_live(p_business) and public.venue_profile_enabled(auth.uid())');
  end if;
  execute definition;
 end loop;
end; $$;
create or replace function public.cafe_set_visibility(p_visible boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_visible is null or not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 if p_visible and not public.venue_profile_enabled(auth.uid()) then raise exception 'Önce genel profil görünürlüğünü açın.' using errcode='22023'; end if;
 update public.cafe_visits set photo_visible=p_visible where user_id=auth.uid() and expires_at>now() and public.cafe_room_live(business_id);
 if not found then raise exception 'Mekâna yeniden katılın.' using errcode='22023'; end if;
 return public.cafe_my_visit();
end; $$;
-- No JSON variable/SQL alias ambiguity; all validation runs before atomic replacement.
create or replace function public.cafe_save_seating(p_business uuid,p_enabled boolean,p_tables jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare entry jsonb;
begin
 if not coalesce(public.account_can_manage(p_business),false) then raise exception 'İşletme yönetim yetkisi gerekli.' using errcode='42501'; end if;
 if not exists(select 1 from public.businesses where id=p_business) then raise exception 'İşletme bulunamadı.' using errcode='22023'; end if;
 if p_enabled is null or p_tables is null or jsonb_typeof(p_tables)<>'array' then raise exception 'Masa planı geçersiz.' using errcode='22023'; end if;
 if jsonb_array_length(p_tables)>60 or (p_enabled and jsonb_array_length(p_tables)=0) then raise exception 'Gösterimi açmak için 1–60 masa ekleyin.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_business::text,20261024));
 for entry in select value from jsonb_array_elements(p_tables) loop
  if entry->>'id' is null or (entry->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or entry->>'label' is null or char_length(btrim(entry->>'label')) not between 1 and 24 or coalesce(entry->>'seats','')!~'^[0-9]+$' or coalesce(entry->>'grid_x','')!~'^[0-9]+$' or coalesce(entry->>'grid_y','')!~'^[0-9]+$' then raise exception 'Masa adı, kapasitesi veya konumu geçersiz.' using errcode='22023'; end if;
  if (entry->>'seats')::integer not between 1 and 12 or (entry->>'grid_x')::integer not between 0 and 5 or (entry->>'grid_y')::integer not between 0 and 9 then raise exception 'Masa kapasitesi veya konumu sınır dışında.' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_tables) e group by e->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_tables) e group by e->>'grid_x',e->>'grid_y' having count(*)>1) then raise exception 'Her masa için farklı konum seçin.' using errcode='22023'; end if;
 if exists(select 1 from public.cafe_tables ct join jsonb_array_elements(p_tables) e on ct.id=(e->>'id')::uuid where ct.business_id<>p_business) then raise exception 'Başka işletmenin masasını düzenleyemezsiniz.' using errcode='42501'; end if;
 -- Only an explicit owner save can remove omitted tables; no attendance, photos or consent is deleted.
 delete from public.cafe_tables ct where ct.business_id=p_business;
 insert into public.cafe_tables(id,business_id,label,seats,grid_x,grid_y)
 select (e->>'id')::uuid,p_business,btrim(e->>'label'),(e->>'seats')::integer,(e->>'grid_x')::integer,(e->>'grid_y')::integer from jsonb_array_elements(p_tables) e;
 insert into public.cafe_rooms(business_id,enabled,occupancy_enabled) values(p_business,false,p_enabled) on conflict(business_id) do update set occupancy_enabled=excluded.occupancy_enabled,updated_at=now();
end; $$;
create or replace function public.cafe_save_seating_payload(p_business uuid,p_enabled boolean,p_plan text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_can_manage(p_business),false) then raise exception 'İşletme yönetim yetkisi gerekli.' using errcode='42501'; end if;
 if p_plan is null or octet_length(p_plan)>65536 then raise exception 'Masa planı geçersiz veya çok büyük.' using errcode='22023'; end if;
 perform public.cafe_save_seating(p_business,p_enabled,p_plan::jsonb);
end; $$;
create or replace function public.cafe_room_state(p_business uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare mine jsonb; enabled boolean; participation boolean; local_visit boolean:=false; peers jsonb:='[]'::jsonb; total integer:=0; plan jsonb:='[]'::jsonb; capacity integer:=0; show_plan boolean:=false; manager boolean; published boolean; plan_visible boolean:=false;
begin
 enabled:=public.cafe_room_live(p_business); participation:=public.cafe_venue_live(p_business); manager:=coalesce(public.account_can_manage(p_business),false);
 published:=exists(select 1 from public.businesses where id=p_business and approval_status='approved' and is_published);
 if not published and not manager then return jsonb_build_object('enabled',false,'participation_enabled',false,'mine',null,'members',peers,'count',0,'tables',plan,'occupancy_enabled',false,'capacity',0,'plan_visible',false,'occupancy_percent',null,'occupancy_visible',false); end if;
 mine:=public.cafe_my_visit(); local_visit:=coalesce(mine->>'business_id'=p_business::text,false);
 show_plan:=coalesce((select occupancy_enabled from public.cafe_rooms where business_id=p_business),false);
 if show_plan or manager then select coalesce(sum(seats),0)::integer into capacity from public.cafe_tables where business_id=p_business; end if;
 plan_visible:=manager or (show_plan and local_visit);
 if plan_visible then select coalesce(jsonb_agg(to_jsonb(t) order by t.grid_y,t.grid_x),'[]'::jsonb) into plan from (select id,label,seats,grid_x,grid_y from public.cafe_tables where business_id=p_business) t; end if;
 if participation then select count(*) into total from public.cafe_visits v where v.business_id=p_business and v.expires_at>now() and public.cafe_customer_live(v.user_id); end if;
 if enabled and local_visit then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into peers from (
   select case when visibility.revealed then v.user_id::text else 'anonymous-'||md5(auth.uid()::text||':'||v.user_id::text) end as user_id,
    case when visibility.revealed then public.venue_masked_name(p.first_name,p.last_name) else 'Kullanıcı' end as name,
    case when visibility.revealed and public.cafe_photo_allowed(ph.path) then ph.path else null end as photo_path,
    not visibility.revealed as anonymous,
    visibility.revealed and exists(select 1 from public.cafe_social_profiles sp where sp.user_id=v.user_id) as has_instagram,
    case when visibility.revealed then req.status else null end as request_status,
    case when visibility.revealed then req.id else null end as request_id
   from public.cafe_visits v join public.user_profiles p on p.id=v.user_id left join public.cafe_profile_photos ph on ph.user_id=v.user_id
   left join public.cafe_instagram_requests req on req.requester_id=auth.uid() and req.recipient_id=v.user_id
   cross join lateral(select v.photo_visible and public.venue_profile_enabled(v.user_id) and not public.cafe_photo_blocked(auth.uid(),v.user_id) as revealed) visibility
   where v.business_id=p_business and v.user_id<>auth.uid() and v.expires_at>now() and public.cafe_customer_live(v.user_id) order by v.joined_at desc limit 100
  ) x;
 end if;
 return jsonb_build_object('enabled',case when manager then coalesce((select r.enabled from public.cafe_rooms r where r.business_id=p_business),false) else enabled end,'participation_enabled',participation,'mine',case when local_visit then mine else null end,'count',total,'members',peers,'tables',plan,'occupancy_enabled',show_plan,'capacity',capacity,'plan_visible',plan_visible,
 'occupancy_visible',show_plan and (local_visit or manager),'occupancy_percent',case when show_plan and (local_visit or manager) and capacity>0 then least(100,round(total::numeric/capacity*100)) else null end);
end; $$;
create or replace function public.cafe_request_instagram(p_target uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_request public.cafe_instagram_requests; room_id uuid;
begin
 if auth.uid() is null or not coalesce(public.cafe_pair_live(auth.uid(),p_target),false) then raise exception 'İstek için aynı mekânda aktif katılım gerekli.' using errcode='42501'; end if;
 -- One sender lock serializes the hourly limit even when requests target different people.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,20261025));
 if public.cafe_photo_blocked(auth.uid(),p_target) then raise exception 'Bir haftalık gizlilik süresi bitmeden yeniden istek gönderilemez.' using errcode='42501'; end if;
 if not exists(select 1 from public.cafe_visits v where v.user_id=p_target and v.photo_visible and public.venue_profile_enabled(v.user_id)) then raise exception 'Bu kullanıcı profil görünürlüğünü kapatmış.' using errcode='42501'; end if;
 if not exists(select 1 from public.cafe_social_profiles where user_id=p_target) then raise exception 'Bu kişi Instagram kullanıcı adı eklememiş.' using errcode='22023'; end if;
 select * into current_request from public.cafe_instagram_requests where requester_id=auth.uid() and recipient_id=p_target;
 if current_request.status in ('pending','accepted') then return jsonb_build_object('id',current_request.id,'status',current_request.status); end if;
 if (select count(*) from public.cafe_instagram_requests where requester_id=auth.uid() and requested_at>now()-interval '1 hour')>=10 then raise exception 'Saatlik istek sınırına ulaştınız. Daha sonra deneyin.' using errcode='42501'; end if;
 select business_id into room_id from public.cafe_visits where user_id=auth.uid();
 insert into public.cafe_instagram_requests(business_id,requester_id,recipient_id) values(room_id,auth.uid(),p_target) on conflict(requester_id,recipient_id) do update set business_id=excluded.business_id,status='pending',requested_at=now(),decided_at=null,blocked_until=null returning * into current_request;
 return jsonb_build_object('id',current_request.id,'status',current_request.status);
end; $$;
create or replace function public.cafe_decide_instagram(p_request uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.cafe_instagram_requests;
begin
 if not coalesce(public.account_customer(),false) or p_accept is null then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select * into r from public.cafe_instagram_requests where id=p_request and recipient_id=auth.uid() for update;
 if not found then raise exception 'Bu isteği yönetemezsiniz.' using errcode='42501'; end if;
 if p_accept and r.status='accepted' then return; end if;
 if not p_accept and r.status='rejected' then return; end if;
 if p_accept and (r.status<>'pending' or not public.cafe_pair_live(r.requester_id,r.recipient_id) or not public.venue_profile_enabled(auth.uid()) or not exists(select 1 from public.cafe_social_profiles where user_id=auth.uid())) then raise exception 'Onay için aynı mekânda aktif katılım, açık profil ve Instagram kullanıcı adı gerekli.' using errcode='42501'; end if;
 update public.cafe_instagram_requests set status=case when p_accept then 'accepted' else 'rejected' end,decided_at=now(),blocked_until=case when p_accept then null else now()+interval '7 days' end where id=r.id;
end; $$;
create or replace function public.cafe_instagram_link(p_request uuid) returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare handle text;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select p.instagram_handle into handle from public.cafe_instagram_requests r join public.cafe_social_profiles p on p.user_id=r.recipient_id join public.cafe_visits v on v.user_id=r.recipient_id
 where r.id=p_request and r.requester_id=auth.uid() and r.status='accepted' and public.cafe_pair_live(r.requester_id,r.recipient_id) and v.photo_visible and public.venue_profile_enabled(r.recipient_id) and not public.cafe_photo_blocked(r.requester_id,r.recipient_id);
 if handle is null then raise exception 'Instagram için izin, görünür profil ve aynı mekânda aktif katılım gerekli.' using errcode='42501'; end if;
 return 'https://www.instagram.com/'||handle||'/';
end; $$;
create or replace function public.cafe_social_state() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare incoming jsonb; outgoing jsonb; sent_count integer;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select count(distinct recipient_id)::integer into sent_count from public.cafe_instagram_requests where requester_id=auth.uid();
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into incoming from (
  select r.id,r.requester_id as user_id,
   case when public.cafe_pair_live(r.requester_id,r.recipient_id) and public.venue_profile_enabled(r.requester_id) and coalesce(v.photo_visible,false) and not public.cafe_photo_blocked(auth.uid(),r.requester_id) then public.venue_masked_name(p.first_name,p.last_name) else 'Kullanıcı' end as name,
   r.status,r.requested_at,r.blocked_until,
   public.cafe_pair_live(r.requester_id,r.recipient_id) and public.venue_profile_enabled(auth.uid()) as can_accept,
   case when public.cafe_photo_allowed(ph.path) then ph.path else null end as photo_path,
   (select count(distinct h.recipient_id) from public.cafe_instagram_requests h where h.requester_id=r.requester_id) as requester_sent_count
  from public.cafe_instagram_requests r join public.user_profiles p on p.id=r.requester_id left join public.cafe_profile_photos ph on ph.user_id=p.id left join public.cafe_visits v on v.user_id=p.id
  where r.recipient_id=auth.uid() and r.status in ('pending','accepted') and public.cafe_customer_live(r.requester_id) order by r.requested_at desc limit 50
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into outgoing from (
  select r.id,r.recipient_id as user_id,r.status,greatest(r.blocked_until,case when r.status='rejected' then r.decided_at+interval '7 days' end) as blocked_until
  from public.cafe_instagram_requests r where r.requester_id=auth.uid() order by r.requested_at desc limit 100
 ) x;
 return jsonb_build_object('incoming',incoming,'outgoing',outgoing,'sent_recipient_count',sent_count);
end; $$;
revoke all on function public.venue_profile_enabled(uuid),public.venue_masked_name(text,text) from public,anon,authenticated;
revoke all on function public.venue_profile_preference(),public.set_venue_profile_preference(boolean),public.cafe_save_seating_payload(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.venue_profile_preference(),public.set_venue_profile_preference(boolean),public.cafe_save_seating_payload(uuid,boolean,text) to authenticated;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261024_venue_social_mutual_instagram.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','cafe_instagram_accessible(p_request uuid)','3fd2ce9c929207b0d0ece62de39eb75d'),
   ('function','cafe_instagram_link(p_request uuid)','f7d284cc9fd098a6c53b464936538906'),
   ('function','cafe_request_instagram(p_target uuid)','64c682e21b7ddd6ee03a7f3d39c635a5'),
   ('function','cafe_decide_instagram(p_request uuid, p_accept boolean)','d921254faed3bace3520da4492cde874'),
   ('function','cafe_social_state()','d78888c06c8b2b724288b1f9f0f9e095,7468439abe67ac71aafb66026b6f80b2'),
   ('function','cafe_instagram_ready(p_user uuid)','8bfa2441707fe3baabd9023be562ea34')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261024_venue_social_mutual_instagram.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261024_venue_social_mutual_instagram.sql';
    execute $mig$-- Mutual Instagram access and handle requirements. Function definitions only; no user records changed.
-- (begin; kaldırıldı)
create or replace function public.cafe_instagram_ready(p_user uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cafe_social_profiles p where p.user_id=p_user and p.instagram_handle ~ '^[A-Za-z0-9_][A-Za-z0-9_.]{0,29}$');
$$;
create or replace function public.cafe_instagram_accessible(p_request uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(public.account_customer(),false) and exists(
  select 1 from public.cafe_instagram_requests r
  join public.cafe_visits target on target.user_id=case when auth.uid()=r.requester_id then r.recipient_id else r.requester_id end
  where r.id=p_request and auth.uid() in (r.requester_id,r.recipient_id) and r.status='accepted'
  and public.cafe_pair_live(r.requester_id,r.recipient_id)
  and public.cafe_instagram_ready(r.requester_id) and public.cafe_instagram_ready(r.recipient_id)
  and target.photo_visible and public.venue_profile_enabled(target.user_id)
  and not public.cafe_photo_blocked(r.requester_id,r.recipient_id)
  and not public.cafe_photo_blocked(r.recipient_id,r.requester_id));
$$;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.cafe_request_instagram(uuid)'::regprocedure);
 if position('if not public.cafe_instagram_ready(auth.uid())' in definition)=0 then
  definition:=replace(definition,'perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,20261025));','if not public.cafe_instagram_ready(auth.uid()) then raise exception ''Önce Instagram kullanıcı adınızı ekleyin.'' using errcode=''22023''; end if; perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,20261025));');
  definition:=replace(definition,'if public.cafe_photo_blocked(auth.uid(),p_target) then','if public.cafe_photo_blocked(auth.uid(),p_target) or public.cafe_photo_blocked(p_target,auth.uid()) then');
  definition:=replace(definition,'if not exists(select 1 from public.cafe_social_profiles where user_id=p_target) then','if not public.cafe_instagram_ready(p_target) then');
  definition:=replace(definition,'select * into current_request from public.cafe_instagram_requests where requester_id=auth.uid() and recipient_id=p_target;','select * into current_request from public.cafe_instagram_requests where requester_id=p_target and recipient_id=auth.uid() and status=''accepted''; if found then return jsonb_build_object(''id'',current_request.id,''status'',current_request.status); end if; select * into current_request from public.cafe_instagram_requests where requester_id=auth.uid() and recipient_id=p_target;');
  execute definition;
 end if;
 definition:=pg_get_functiondef('public.cafe_decide_instagram(uuid,boolean)'::regprocedure);
 if position('if p_accept and (not public.cafe_instagram_ready' in definition)=0 then
  definition:=replace(definition,'if p_accept and r.status=''accepted'' then return; end if;','if p_accept and (not public.cafe_instagram_ready(r.requester_id) or not public.cafe_instagram_ready(r.recipient_id)) then raise exception ''Onay için ikinizin de Instagram kullanıcı adı olmalı.'' using errcode=''22023''; end if; if p_accept and r.status=''accepted'' then return; end if;');
  execute definition;
 end if;
end; $$;
create or replace function public.cafe_instagram_link(p_request uuid) returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare handle text;
begin
 if not coalesce(public.cafe_instagram_accessible(p_request),false) then raise exception 'Instagram için karşılıklı izin, kullanıcı adları ve aynı mekânda görünür katılım gerekli.' using errcode='42501'; end if;
 select p.instagram_handle into handle from public.cafe_instagram_requests r join public.cafe_social_profiles p on p.user_id=case when auth.uid()=r.requester_id then r.recipient_id else r.requester_id end where r.id=p_request and auth.uid() in (r.requester_id,r.recipient_id);
 if handle is null then raise exception 'Instagram kullanıcı adı bulunamadı.' using errcode='42501'; end if;
 return 'https://www.instagram.com/'||handle||'/';
end; $$;
create or replace function public.cafe_social_state() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare incoming jsonb; outgoing jsonb; sent_count integer;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 select count(distinct recipient_id)::integer into sent_count from public.cafe_instagram_requests where requester_id=auth.uid();
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into incoming from (
  select r.id,r.requester_id as user_id,
   case when public.cafe_pair_live(r.requester_id,r.recipient_id) and public.venue_profile_enabled(r.requester_id) and coalesce(v.photo_visible,false) and not public.cafe_photo_blocked(auth.uid(),r.requester_id) then public.venue_masked_name(p.first_name,p.last_name) else 'Kullanıcı' end as name,
   r.status,r.requested_at,r.blocked_until,
   public.cafe_pair_live(r.requester_id,r.recipient_id) as in_same_venue,
   public.cafe_pair_live(r.requester_id,r.recipient_id) and public.venue_profile_enabled(auth.uid()) and public.cafe_instagram_ready(r.requester_id) and public.cafe_instagram_ready(r.recipient_id) as can_accept,
   public.cafe_instagram_accessible(r.id) as can_open,
   case when public.cafe_photo_allowed(ph.path) then ph.path else null end as photo_path,
   (select count(distinct h.recipient_id) from public.cafe_instagram_requests h where h.requester_id=r.requester_id) as requester_sent_count
  from public.cafe_instagram_requests r join public.user_profiles p on p.id=r.requester_id left join public.cafe_profile_photos ph on ph.user_id=p.id left join public.cafe_visits v on v.user_id=p.id
  where r.recipient_id=auth.uid() and r.status in ('pending','accepted') and public.cafe_customer_live(r.requester_id) order by r.requested_at desc limit 50
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into outgoing from (
  select r.id,r.recipient_id as user_id,r.status,public.cafe_instagram_accessible(r.id) as can_open,greatest(r.blocked_until,case when r.status='rejected' then r.decided_at+interval '7 days' end) as blocked_until
  from public.cafe_instagram_requests r where r.requester_id=auth.uid() order by r.requested_at desc limit 100
 ) x;
 return jsonb_build_object('incoming',incoming,'outgoing',outgoing,'sent_recipient_count',sent_count);
end; $$;
revoke all on function public.cafe_instagram_ready(uuid),public.cafe_instagram_accessible(uuid) from public,anon,authenticated;
revoke all on function public.cafe_instagram_link(uuid),public.cafe_social_state() from public,anon,authenticated;
grant execute on function public.cafe_instagram_link(uuid),public.cafe_social_state() to authenticated;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261024_all_business_participation.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','cafe_room_live(p_business uuid)','20cd31fdce97932f553e90a8397e436d,a52af1d8e4639a7e188074d31d230571'),
   ('function','cafe_set_room(p_business uuid, p_enabled boolean)','19b51449a1364946b550768f1a96dc3d,9b44ef6a9f0b3bde1c1abf72c7157dbe'),
   ('function','cafe_venue_live(p_business uuid)','ffc8cd21fb908cb3cf88dbb6a68aef69,158e4e02fb71fb1615a1e67e88f8d5ba'),
   ('function','cafe_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','bd1f9aa4a93bc9d2f455d22fc5c70c3e,40cc01ee57d6d2bb32b94973bcbb3862,de6776b034285e751a970d62201f74e5')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261024_all_business_participation.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261024_all_business_participation.sql';
    execute $mig$-- Extend owner-opt-in presence, profiles and seating to every business category.
-- Function definitions only: no business preferences, visits, plans or user data are changed.
-- (begin; kaldırıldı)
do $$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.cafe_room_live(uuid)',
  'public.cafe_venue_live(uuid)',
  'public.cafe_set_room(uuid,boolean)',
  'public.cafe_save_seating(uuid,boolean,jsonb)',
  'public.cafe_room_state(uuid)',
  'public.cafe_nearby(double precision,double precision,double precision,timestamptz)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  -- Remove only the category predicate; keep owner, publication, opt-in and GPS guards.
  definition:=replace(definition,'and b.category=''kafe''','');
  definition:=replace(definition,'and category=''kafe''','');
  definition:=replace(definition,'Önce kafe kategorisini ve işletme konumunu kaydedin.','Önce işletme konumunu kaydedin.');
  definition:=replace(definition,'Masa planı yalnızca kafeler içindir.','İşletme bulunamadı.');
  definition:=replace(definition,'Başka kafenin masasını düzenleyemezsiniz.','Başka işletmenin masasını düzenleyemezsiniz.');
  execute definition;
 end loop;
 -- Existing Instagram authorization logic is unchanged; only user-facing wording is generalized.
 foreach signature in array array[
  'public.cafe_set_visibility(boolean)',
  'public.cafe_request_instagram(uuid)',
  'public.cafe_decide_instagram(uuid,boolean)',
  'public.cafe_instagram_link(uuid)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'Kafeye yeniden katılın.','Mekâna yeniden katılın.');
  definition:=replace(definition,'aynı kafede','aynı mekânda');
  execute definition;
 end loop;
end; $$;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261025_venue_live_inbox.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('table','customer_inbox',''),
   ('table','customer_inbox_reads',''),
   ('index','customer_inbox_pkey',''),
   ('index','customer_inbox_reads_pkey',''),
   ('index','customer_inbox_user_created_idx',''),
   ('trigger','cafe_notify_consent',''),
   ('trigger','order_open_guard',''),
   ('policy','customer_inbox.authenticated_select_own_inbox',''),
   ('policy','customer_inbox_reads.authenticated_select_own_inbox_reads',''),
   ('column','customer_inbox.business_id',''),
   ('column','customer_inbox.created_at',''),
   ('column','customer_inbox.id',''),
   ('column','customer_inbox.kind',''),
   ('column','customer_inbox.request_id',''),
   ('column','customer_inbox.user_id',''),
   ('column','customer_inbox_reads.item_id',''),
   ('column','customer_inbox_reads.read_at',''),
   ('column','customer_inbox_reads.user_id',''),
   ('function','cafe_room_live(p_business uuid)','a52af1d8e4639a7e188074d31d230571'),
   ('function','cafe_set_room(p_business uuid, p_enabled boolean)','9b44ef6a9f0b3bde1c1abf72c7157dbe'),
   ('function','cafe_my_visit()','81b144615b352416c527cf460da3bcf1'),
   ('function','cafe_photo_allowed(p_path text)','5826685db84d542eaa6ac74c1b3f4fe2'),
   ('function','cafe_venue_live(p_business uuid)','158e4e02fb71fb1615a1e67e88f8d5ba'),
   ('function','cafe_social_state()','7468439abe67ac71aafb66026b6f80b2'),
   ('function','cafe_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','40cc01ee57d6d2bb32b94973bcbb3862,de6776b034285e751a970d62201f74e5'),
   ('function','cafe_join(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone, p_visible boolean)','b1172c59b2999348ee5031b7457e78e6,605a06ef1425ad9c8bc2257803a55f93'),
   ('function','cafe_room_state(p_business uuid)','df816f0da83233e06a21125ad8b10473'),
   ('function','cafe_revoke_instagram(p_request uuid)','b325ed963dfe2842ea2973aa86ef2d5f'),
   ('function','cafe_refresh_location(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','b75ed7465f70768614b2ba7d0f590cbc,685dca7fda59c2197de40e12f40fc7dc,e10a9d8a7070f10fc9cc90487dd5de86'),
   ('function','customer_inbox_items()','9eb04996068873aa841380637c46dd80'),
   ('function','customer_inbox_read(p_id text)','c25dcaf263f94336a1355b90a14982da'),
   ('function','order_open_guard()','b21ff54c4b8c74dd3a4902393e9c7f9d'),
   ('function','cafe_notify_consent()','accdbb09b5ff90d007eeae48366019e1'),
   ('function','business_is_open(p_business uuid)','cd8632fd2b97e42851fc7c8ab9b1b3e6')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261025_venue_live_inbox.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261025_venue_live_inbox.sql';
    execute $mig$-- Live venue presence, public aggregate occupancy, private education and a persistent customer inbox.
-- Additive schema/function changes only; no existing user records are migrated or removed.
-- (begin; kaldırıldı)
alter table public.user_profiles add column if not exists school_name text;
alter table public.user_profiles add column if not exists education_status text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='profile_education_valid' and conrelid='public.user_profiles'::regclass) then
  alter table public.user_profiles add constraint profile_education_valid check(education_status is null or education_status in ('none','secondary','associate','bachelor','master','doctorate','graduate'));
  alter table public.user_profiles add constraint profile_school_length check(school_name is null or char_length(school_name)<=120);
 end if;
end; $$;
-- Participation is mandatory on published geolocated venues; personal visibility remains optional.
create or replace function public.cafe_room_live(p_business uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.businesses b where b.id=p_business and b.approval_status='approved' and b.is_published and b.lat is not null and b.lng is not null);
$$;
create or replace function public.cafe_venue_live(p_business uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select public.cafe_room_live(p_business); $$;
create or replace function public.cafe_set_room(p_business uuid,p_enabled boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_can_manage(p_business),false) then raise exception 'İşletme yönetim yetkisi gerekli.' using errcode='42501'; end if;
 if p_enabled is distinct from true then raise exception 'Mekândaki kullanıcıların erişimi işletme tarafından kapatılamaz.' using errcode='22023'; end if;
 return jsonb_build_object('enabled',public.cafe_room_live(p_business));
end; $$;
create or replace function public.cafe_nearby(p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 if p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 20) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve hassas konum gerekli (en fazla 20 m hassasiyet).' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.distance_meters),'[]'::jsonb) from (
  select b.id as business_id,b.name as business_name,true as social_enabled,6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-b.lat)/2),2)+cos(radians(b.lat))*cos(radians(p_lat))*power(sin(radians(p_lng-b.lng)/2),2)))) as distance_meters
  from public.businesses b where public.cafe_venue_live(b.id)
 ) x where x.distance_meters<40);
end; $$;
create or replace function public.cafe_my_visit() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select (select jsonb_build_object('business_id',v.business_id,'business_name',b.name,'photo_visible',v.photo_visible,'expires_at',v.expires_at,'social_enabled',true) from public.cafe_visits v join public.businesses b on b.id=v.business_id where v.user_id=auth.uid() and v.expires_at>now() and public.cafe_customer_live(v.user_id) and public.cafe_venue_live(v.business_id));
$$;
create or replace function public.cafe_join(p_business uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz,p_visible boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_lat double precision; v_lng double precision; v_distance double precision;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 if not public.cafe_venue_live(p_business) then raise exception 'İşletme yayında değil veya konumu eksik.' using errcode='42501'; end if;
 if p_visible is null or p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 20) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve hassas konum gerekli (en fazla 20 m).' using errcode='22023'; end if;
 select b.lat,b.lng into v_lat,v_lng from public.businesses b where b.id=p_business;
 v_distance:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-v_lng)/2),2))));
 if v_distance>=40 then raise exception 'Konumla doğrulamak için işletmeye 40 metreden yakın olun.' using errcode='42501'; end if;
 insert into public.cafe_visits(user_id,business_id,photo_visible,expires_at) values(auth.uid(),p_business,p_visible and public.venue_profile_enabled(auth.uid()),now()+interval '90 seconds')
 on conflict(user_id) do update set business_id=excluded.business_id,photo_visible=excluded.photo_visible,joined_at=case when cafe_visits.business_id=excluded.business_id and cafe_visits.expires_at>now() then cafe_visits.joined_at else now() end,expires_at=excluded.expires_at;
 return public.cafe_my_visit();
end; $$;
-- A heartbeat may only renew an already-live confirmed visit; it never silently re-enters a venue.
create or replace function public.cafe_refresh_location(p_business uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured_at timestamptz) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_lat double precision; v_lng double precision; v_distance double precision;
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 if not exists(select 1 from public.cafe_visits v where v.user_id=auth.uid() and v.business_id=p_business and v.expires_at>now()) then return null; end if;
 if p_lat is null or p_lng is null or p_accuracy is null or p_captured_at is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and 20) or p_captured_at<now()-interval '60 seconds' or p_captured_at>now()+interval '15 seconds' then raise exception 'Güncel ve hassas konum gerekli.' using errcode='22023'; end if;
 select b.lat,b.lng into v_lat,v_lng from public.businesses b where b.id=p_business;
 v_distance:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p_lat-v_lat)/2),2)+cos(radians(v_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-v_lng)/2),2))));
 if not public.cafe_venue_live(p_business) or v_distance>40 then
  update public.cafe_visits set expires_at=now(),photo_visible=false where user_id=auth.uid() and business_id=p_business;
  return null;
 end if;
 update public.cafe_visits set expires_at=now()+interval '90 seconds' where user_id=auth.uid() and business_id=p_business and expires_at>now();
 return public.cafe_my_visit();
end; $$;
-- Photo access requires the viewer's own Instagram and current co-presence, even for accepted requests.
create or replace function public.cafe_photo_allowed(p_path text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.account_active(),false) and (split_part(p_path,'/',1)=auth.uid()::text or (public.cafe_instagram_ready(auth.uid()) and exists(
 select 1 from public.cafe_profile_photos ph join public.cafe_visits target on target.user_id=ph.user_id join public.cafe_visits viewer on viewer.business_id=target.business_id
 where ph.path=p_path and target.photo_visible and public.venue_profile_enabled(target.user_id) and target.expires_at>now() and viewer.user_id=auth.uid() and viewer.expires_at>now() and public.cafe_customer_live(target.user_id) and public.cafe_customer_live(viewer.user_id) and public.cafe_room_live(target.business_id) and not public.cafe_photo_blocked(viewer.user_id,target.user_id))));
$$;
create or replace function public.cafe_room_state(p_business uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_mine jsonb; v_local boolean; v_live boolean; v_manager boolean; v_members jsonb:='[]'::jsonb; v_plan jsonb:='[]'::jsonb; v_capacity integer:=0; v_count integer:=0; v_female integer:=0; v_male integer:=0; v_student integer:=0; v_university integer:=0; v_nonstudent integer:=0; v_education_unknown integer:=0; v_show boolean:=false;
begin
 v_live:=public.cafe_venue_live(p_business); v_manager:=coalesce(public.account_can_manage(p_business),false);
 if not v_live and not v_manager then return jsonb_build_object('enabled',false,'participation_enabled',false,'occupancy_enabled',false,'occupancy_visible',false,'occupancy_percent',null,'mine',null,'members',v_members,'tables',v_plan,'count',0); end if;
 v_mine:=public.cafe_my_visit(); v_local:=coalesce(v_mine->>'business_id'=p_business::text,false);
 select coalesce(sum(t.seats),0)::integer into v_capacity from public.cafe_tables t where t.business_id=p_business;
 v_show:=coalesce((select r.occupancy_enabled from public.cafe_rooms r where r.business_id=p_business),false);
 if v_manager then select coalesce(jsonb_agg(to_jsonb(t) order by t.grid_y,t.grid_x),'[]'::jsonb) into v_plan from (select id,label,seats,grid_x,grid_y from public.cafe_tables where business_id=p_business) t; end if;
 select count(*)::integer,count(*) filter(where p.gender='female')::integer,count(*) filter(where p.gender='male')::integer,
 count(*) filter(where p.education_status in ('secondary','associate','bachelor','master','doctorate'))::integer,
 count(*) filter(where p.education_status in ('associate','bachelor','master','doctorate'))::integer,
 count(*) filter(where p.education_status in ('none','graduate'))::integer,
 count(*) filter(where p.education_status is null)::integer
 into v_count,v_female,v_male,v_student,v_university,v_nonstudent,v_education_unknown
 from public.cafe_visits v join public.user_profiles p on p.id=v.user_id where v.business_id=p_business and v.expires_at>now() and public.cafe_customer_live(v.user_id);
 if v_live and v_local and public.cafe_instagram_ready(auth.uid()) then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_members from (
   select case when visibility.revealed then v.user_id::text else 'anonymous-'||md5(auth.uid()::text||':'||v.user_id::text) end as user_id,
   case when visibility.revealed then public.venue_masked_name(p.first_name,p.last_name) else 'Kullanıcı' end as name,
   case when visibility.revealed and public.cafe_photo_allowed(ph.path) then ph.path else null end as photo_path,
   not visibility.revealed as anonymous,visibility.revealed and public.cafe_instagram_ready(v.user_id) as has_instagram,
   case when visibility.revealed then p.education_status else null end as education_status,
   case when visibility.revealed and p.education_status in ('secondary','associate','bachelor','master','doctorate') then p.school_name else null end as school_name,
   case when visibility.revealed then req.status else null end as request_status,case when visibility.revealed then req.id else null end as request_id
   from public.cafe_visits v join public.user_profiles p on p.id=v.user_id left join public.cafe_profile_photos ph on ph.user_id=v.user_id
   left join public.cafe_instagram_requests req on req.requester_id=auth.uid() and req.recipient_id=v.user_id
   cross join lateral(select v.photo_visible and public.venue_profile_enabled(v.user_id) and not public.cafe_photo_blocked(auth.uid(),v.user_id) as revealed) visibility
   where v.business_id=p_business and v.user_id<>auth.uid() and v.expires_at>now() and public.cafe_customer_live(v.user_id) order by v.joined_at desc limit 100
  ) x;
 end if;
 return jsonb_build_object('enabled',v_live,'participation_enabled',v_live,'mine',case when v_local then v_mine else null end,'count',v_count,'members',v_members,'tables',v_plan,'plan_visible',v_manager,'capacity',v_capacity,'occupancy_enabled',true,'occupancy_visible',v_live or v_manager,'occupancy_percent',case when v_show and v_capacity>0 then least(100,round(v_count::numeric/v_capacity*100)) else null end,
 'demographics',jsonb_build_object('total',v_count,'female',v_female,'male',v_male,'gender_unknown',v_count-v_female-v_male,'student',v_student,'university',v_university,'nonstudent',v_nonstudent,'education_unknown',v_education_unknown));
end; $$;
-- Either side may withdraw an accepted grant, without extending the one-week rejection rule.
create or replace function public.cafe_revoke_instagram(p_request uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 update public.cafe_instagram_requests set status='rejected',decided_at=now(),blocked_until=now()+interval '7 days' where id=p_request and auth.uid() in (requester_id,recipient_id) and status in ('pending','accepted');
 if not found then raise exception 'İstek bulunamadı veya izin zaten kaldırılmış.' using errcode='42501'; end if;
end; $$;
-- Keep existing consent/count projection, masking sender names for Instagram-less viewers.
do $$ declare v_definition text; begin
 v_definition:=pg_get_functiondef('public.cafe_social_state()'::regprocedure);
 v_definition:=replace(v_definition,'case when public.cafe_pair_live(r.requester_id,r.recipient_id) and','case when public.cafe_instagram_ready(auth.uid()) and public.cafe_pair_live(r.requester_id,r.recipient_id) and');
 execute v_definition;
end; $$;
-- Server-authoritative Istanbul opening hours. Manual mode always respects the owner switch.
create or replace function public.business_is_open(p_business uuid) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_b public.businesses; v_now timestamp:=now() at time zone 'Europe/Istanbul'; v_open integer; v_close integer; v_minute integer; v_day integer; v_range text[];
begin
 select * into v_b from public.businesses where id=p_business;
 if not found or v_b.approval_status<>'approved' or not v_b.is_published then return false; end if;
 if v_b.status_mode<>'auto' then return v_b.is_open; end if;
 if coalesce(v_b.open_time,'') !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' or coalesce(v_b.close_time,'') !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then
  v_range:=regexp_match(coalesce(v_b.hours,''),'([0-9]{1,2}:[0-9]{2})\s*[-–—]\s*([0-9]{1,2}:[0-9]{2})');
  if v_range is null then return v_b.is_open and (jsonb_array_length(v_b.open_days)=0 or v_b.open_days @> jsonb_build_array(extract(dow from v_now)::integer)); end if;
  v_b.open_time:=v_range[1]; v_b.close_time:=v_range[2];
 end if;
 v_open:=split_part(v_b.open_time,':',1)::integer*60+split_part(v_b.open_time,':',2)::integer;
 v_close:=split_part(v_b.close_time,':',1)::integer*60+split_part(v_b.close_time,':',2)::integer;
 if v_open not between 0 and 1439 or v_close not between 0 and 1439 then return v_b.is_open; end if;
 v_minute:=extract(hour from v_now)::integer*60+extract(minute from v_now)::integer; v_day:=extract(dow from v_now)::integer;
 if v_close<=v_open and v_minute<v_close then v_day:=(v_day+6)%7; end if;
 return (jsonb_array_length(v_b.open_days)=0 or v_b.open_days @> jsonb_build_array(v_day)) and (case when v_close>v_open then v_minute>=v_open and v_minute<v_close else v_minute>=v_open or v_minute<v_close end);
end; $$;
create or replace function public.order_open_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.business_is_open(new.business_id) then raise exception 'İşletme kapalı. Açılana kadar sipariş verilemez.' using errcode='42501'; end if;
 return new;
end; $$;
do $$ begin if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='order_open_guard') then create trigger order_open_guard before insert on public.orders for each row execute function public.order_open_guard(); end if; end; $$;
create table if not exists public.customer_inbox (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id) on delete cascade,
 kind text not null check(kind in ('instagram_pending','instagram_accepted','instagram_rejected')),request_id uuid not null references public.cafe_instagram_requests(id) on delete cascade,
 business_id uuid references public.businesses(id) on delete set null,created_at timestamptz not null default now()
);
create table if not exists public.customer_inbox_reads (
 user_id uuid not null references public.user_profiles(id) on delete cascade,item_id text not null,read_at timestamptz not null default now(),primary key(user_id,item_id)
);
alter table public.customer_inbox enable row level security;
alter table public.customer_inbox_reads enable row level security;
revoke all on public.customer_inbox,public.customer_inbox_reads from anon,authenticated;
grant all on public.customer_inbox,public.customer_inbox_reads to service_role;
create index if not exists customer_inbox_user_created_idx on public.customer_inbox(user_id,created_at desc);
-- Tables have no direct client writes; separate own-read policies guard any future select grants.
create policy authenticated_select_own_inbox on public.customer_inbox for select to authenticated using(user_id=auth.uid());
create policy authenticated_select_own_inbox_reads on public.customer_inbox_reads for select to authenticated using(user_id=auth.uid());
create or replace function public.cafe_notify_consent() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
 insert into public.customer_inbox(user_id,kind,request_id,business_id) values(case when new.status='pending' then new.recipient_id else case when auth.uid()=new.requester_id then new.recipient_id else new.requester_id end end,'instagram_'||new.status,new.id,new.business_id);
 return new;
end; $$;
do $$ begin if not exists(select 1 from pg_trigger where tgrelid='public.cafe_instagram_requests'::regclass and tgname='cafe_notify_consent') then create trigger cafe_notify_consent after insert or update on public.cafe_instagram_requests for each row execute function public.cafe_notify_consent(); end if; end; $$;
create or replace function public.customer_inbox_items() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gerekli.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) from (select * from (
  select 'order-'||o.id::text as id,'order'::text as kind,o.business_name as title,
  case o.status when 'approved' then 'Siparişiniz onaylandı, hazırlanıyor.' when 'on_the_way' then 'Siparişiniz yola çıktı.' when 'delivered' then 'Siparişiniz teslim edildi.' when 'rejected' then 'Siparişiniz reddedildi.' else 'Siparişiniz alındı.' end as body,
  ord.business_id,o.order_id,null::uuid as request_id,o.created_at,coalesce(rr.read_at,o.read_at) as read_at
  from public.order_messages o join public.orders ord on ord.id=o.order_id left join public.customer_inbox_reads rr on rr.user_id=auth.uid() and rr.item_id='order-'||o.id::text where o.user_id=auth.uid()
  union all
  select 'social-'||n.id::text,n.kind,'Instagram',case n.kind when 'instagram_pending' then 'Yeni Instagram görme isteği.' when 'instagram_accepted' then 'Karşılıklı Instagram izni verildi.' else 'Instagram izni kaldırıldı veya istek reddedildi.' end,n.business_id,null::uuid,n.request_id,n.created_at,rr.read_at
  from public.customer_inbox n left join public.customer_inbox_reads rr on rr.user_id=auth.uid() and rr.item_id='social-'||n.id::text where n.user_id=auth.uid()
  union all
  select 'legacy-'||r.id::text,'instagram_pending','Instagram','Yeni Instagram görme isteği.',r.business_id,null::uuid,r.id,r.requested_at,rr.read_at
  from public.cafe_instagram_requests r left join public.customer_inbox_reads rr on rr.user_id=auth.uid() and rr.item_id='legacy-'||r.id::text
  where r.recipient_id=auth.uid() and r.status='pending' and not exists(select 1 from public.customer_inbox n where n.request_id=r.id and n.user_id=auth.uid() and n.kind='instagram_pending')
 ) source order by source.created_at desc,source.id limit 200) x);
end; $$;
create or replace function public.customer_inbox_read(p_id text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.account_customer(),false) or not exists(select 1 from jsonb_array_elements(public.customer_inbox_items()) x where x->>'id'=p_id) then raise exception 'Bildirim bulunamadı.' using errcode='42501'; end if;
 insert into public.customer_inbox_reads(user_id,item_id) values(auth.uid(),p_id) on conflict(user_id,item_id) do nothing;
 -- Reading the inbox also acknowledges the corresponding order bubble, without removing history.
 if p_id like 'order-%' then update public.order_messages set read_at=coalesce(read_at,now()) where id=substring(p_id from 7)::uuid and user_id=auth.uid(); end if;
end; $$;
revoke all on function public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz),public.cafe_revoke_instagram(uuid),public.customer_inbox_items(),public.customer_inbox_read(text) from public,anon,authenticated;
grant execute on function public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz),public.cafe_revoke_instagram(uuid),public.customer_inbox_items(),public.customer_inbox_read(text) to authenticated;
revoke all on function public.business_is_open(uuid),public.order_open_guard(),public.cafe_notify_consent() from public,anon,authenticated;
grant execute on function public.business_is_open(uuid) to authenticated;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261025_venue_refresh_serialization.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','cafe_refresh_location(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','685dca7fda59c2197de40e12f40fc7dc,e10a9d8a7070f10fc9cc90487dd5de86')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261025_venue_refresh_serialization.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261025_venue_refresh_serialization.sql';
    execute $mig$-- Serialize live heartbeats against manual leave/join; function-only migration.
-- Lock the caller's existing visit before renewing, so a concurrent exit cannot be resurrected.
-- (begin; kaldırıldı)
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz)'::regprocedure);
 definition:=replace(definition,'if not exists(select 1 from public.cafe_visits v where v.user_id=auth.uid() and v.business_id=p_business and v.expires_at>now()) then return null; end if;',
 'perform 1 from public.cafe_visits v where v.user_id=auth.uid() and v.business_id=p_business and v.expires_at>clock_timestamp() for update; if not found then return null; end if;');
 execute definition;
end; $$;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261026_venue_radius_50m.sql
do $catchup$
declare missing int;
begin
  select count(*) into missing from (values
   ('function','cafe_nearby(p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','de6776b034285e751a970d62201f74e5'),
   ('function','cafe_join(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone, p_visible boolean)','605a06ef1425ad9c8bc2257803a55f93'),
   ('function','cafe_refresh_location(p_business uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_captured_at timestamp with time zone)','e10a9d8a7070f10fc9cc90487dd5de86')
  ) as m(kind, obj, extra) where not (case m.kind
 when 'table' then to_regclass('public.'||m.obj) is not null
 when 'column' then exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name||'.'||c.column_name=m.obj)
 when 'index' then exists(select 1 from pg_indexes x where x.schemaname='public' and x.indexname=m.obj)
 when 'trigger' then exists(select 1 from pg_trigger t where t.tgname=m.obj and not t.tgisinternal)
 when 'policy' then exists(select 1 from pg_policies y where y.schemaname='public' and y.tablename||'.'||y.policyname=m.obj)
 when 'function' then exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=m.obj and md5(replace(p.prosrc,chr(13),''))=any(string_to_array(m.extra,',')))
end);
  if missing = 0 then
    raise notice 'ATLANDI     (zaten uygulanmış): %', '20261026_venue_radius_50m.sql';
  else
    raise notice 'UYGULANIYOR  (% eksik nesne): %', missing, '20261026_venue_radius_50m.sql';
    execute $mig$-- Widen confirmed venue entry/exit to 50 m and remove the GPS accuracy ceiling.
-- Function definitions only: preserve existing visits, privacy, consent, RLS and heartbeat locking.
-- (begin; kaldırıldı)
do $$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)',
  'public.cafe_nearby(double precision,double precision,double precision,timestamptz)',
  'public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'or p_accuracy is null ','');
  definition:=replace(definition,'not(p_accuracy between 0 and 20)','(p_accuracy is not null and (p_accuracy<0 or p_accuracy::text in (''NaN'',''Infinity'',''-Infinity'')))');
  definition:=replace(definition,'x.distance_meters<40','x.distance_meters<50');
  definition:=replace(definition,'v_distance>=40','v_distance>=50');
  definition:=replace(definition,'v_distance>40','v_distance>=50');
  definition:=replace(definition,'40 metreden yakın','50 metreden yakın');
  definition:=replace(definition,'Güncel ve hassas konum gerekli (en fazla 20 m hassasiyet).','Güncel konum gerekli.');
  definition:=replace(definition,'Güncel ve hassas konum gerekli (en fazla 20 m).','Güncel konum gerekli.');
  definition:=replace(definition,'Güncel ve hassas konum gerekli.','Güncel konum gerekli.');
  if position('between 0 and 20' in definition)>0 or position('en fazla 20' in definition)>0 then raise exception 'Old accuracy ceiling remains'; end if;
  execute definition;
 end loop;
end; $$;
-- (commit; kaldırıldı)
notify pgrst,'reload schema';
$mig$;
  end if;
end
$catchup$;

-- 20261027_function_privilege_hardening.sql  (her çalıştırmada güvenle tekrarlanabilir; yalnızca tanım/yetki yeniler)
do $catchup$
begin
  raise notice 'UYGULANIYOR  (her zaman, tekrarlanabilir): %', '20261027_function_privilege_hardening.sql';
  execute $mig$-- Caddeden · 20261027 — fonksiyon yetkisi sertleştirme (SECURITY DEFINER / anon / PUBLIC denetimi sonucu).
-- Yalnızca EXECUTE yetkisini daraltır; tablo, veri, politika ve fonksiyon gövdesi değişmez. Tekrar çalıştırmak güvenlidir.
-- Dayanak (kodda tek tek doğrulandı):
--  * Tetikleyici fonksiyonları PostgREST ile çağrılamaz ve tetikleyici çalışırken çağıranın EXECUTE yetkisi gerekmez
--    (yetki yalnızca CREATE TRIGGER sırasında denenir). Bu yüzden hiçbir istemci rolüne açık olmamalı.
--  * account_type_pending(uuid) herhangi bir kullanıcı kimliği için "hesap türü kararı bekliyor" bilgisini döndürür.
--    Yalnızca başka SECURITY DEFINER fonksiyonlar (feedback_actor, business_star_state, submit_business_star, hesap yardımcıları) çağırır.
--  * account_* / feedback_admin_allowed yalnızca auth.uid() sahibini sorgular ve yalnızca RLS politikalarında (authenticated) ile
--    giriş yapmış kullanıcı akışlarında kullanılır; anon için hiçbir politika bunları çağırmaz.
-- Bilerek anon'a AÇIK bırakılanlar (uygulama giriş yapmadan çağırır): public_paid_campaigns, public_cadde_tv_channels,
-- public_complaint_email, public_menu_search, university_public_messages, feedback_read, feedback_ratings, business_star_state,
-- business_star_stats, experiences_enabled, cafe_room_state, discovery_search_text.
-- (begin; kaldırıldı)
do $harden$
declare r record; n integer:=0;
begin
 for r in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as args from pg_proc p
          where p.pronamespace='public'::regnamespace and p.prokind='f' and p.prorettype='trigger'::regtype
            and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') loop
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',r.proname,r.args); n:=n+1;
 end loop;
 raise notice 'Tetikleyici fonksiyonlarından istemci EXECUTE yetkisi kaldırıldı: %',n;
 if to_regprocedure('public.account_type_pending(uuid)') is not null then
  revoke all on function public.account_type_pending(uuid) from public,anon,authenticated;
  grant execute on function public.account_type_pending(uuid) to service_role;
 end if;
 for r in select unnest(array['public.account_active()','public.account_admin()','public.account_can_manage(uuid)','public.account_customer()',
                              'public.account_media_owner(text)','public.account_role()','public.feedback_admin_allowed()']) as sig loop
  if to_regprocedure(r.sig) is not null then
   execute format('revoke all on function %s from public,anon',r.sig);
   execute format('grant execute on function %s to authenticated,service_role',r.sig);
  end if;
 end loop;

 -- Supabase varsayılan yetkileri yeni tablolarda anon'a da ALL verir; RLS engeller ama yetkiyi kökten kaldırmak daha güvenli.
 -- Yalnızca anon için hiçbir okuma/yazma politikası bulunmayan gizli/yönetici tabloları.
 for r in select t from unnest(array['app_config','admin_logs','admin_alerts','payments','account_deletion_requests','account_type_decisions',
                                      'business_account_approvals','feedback_rate_limits','media_cleanup_queue','experience_feature_settings']) t loop
  if to_regclass('public.'||r.t) is not null then execute format('revoke all on public.%I from anon',r.t); end if;
 end loop;
end;
$harden$;
-- (commit; kaldırıldı)
$mig$;
end
$catchup$;

notify pgrst, 'reload schema';
commit;

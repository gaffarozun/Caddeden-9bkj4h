-- Caddeden · YALNIZCA baseline (sonraki migration'lar olmadan) güvenlik duman testi — YEREL / ATILABİLİR veritabanı içindir.
-- Canlı Supabase projesinde ÇALIŞTIRMAYIN. Tek işlemde çalışır, sonunda ROLLBACK yapar.
begin;
select set_config('t.fail','0',true), set_config('t.pass','0',true);

create function pg_temp.act(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
 reset role;
 perform set_config('request.jwt.claims', json_build_object('sub',uid,'role',r)::text, true);
 perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
 execute format('set local role %I', r);
end; $$;
create function pg_temp.su() returns void language plpgsql as $$
begin
 reset role;
 perform set_config('request.jwt.claims','',true); perform set_config('request.jwt.claim.sub','',true);
end; $$;
create function pg_temp.pass(label text) returns void language plpgsql as $$
begin
 perform set_config('t.pass',(coalesce(nullif(current_setting('t.pass',true),'')::int,0)+1)::text,true);
 raise notice 'PASS  %',label;
end; $$;
create function pg_temp.fail(label text, why text) returns void language plpgsql as $$
begin
 perform set_config('t.fail',(coalesce(nullif(current_setting('t.fail',true),'')::int,0)+1)::text,true);
 raise notice 'FAIL  %  -- %',label,why;
end; $$;
-- sql hata VERMELİ
create function pg_temp.denied(label text, q text) returns void language plpgsql as $$
begin
 begin execute q; perform pg_temp.fail(label,'hata beklenirken işlem başarılı oldu');
 exception when others then perform pg_temp.pass(label||' ['||left(sqlerrm,60)||']'); end;
end; $$;
-- sql hatasız çalışmalı
create function pg_temp.allowed(label text, q text) returns void language plpgsql as $$
begin
 begin execute q; perform pg_temp.pass(label);
 exception when others then perform pg_temp.fail(label,sqlerrm); end;
end; $$;
-- DML etkilenen satır sayısı beklenen olmalı (RLS ile 0 satır dahil)
create function pg_temp.rows(label text, q text, expected int) returns void language plpgsql as $$
declare n int;
begin
 begin execute q; get diagnostics n = row_count;
  if n = expected then perform pg_temp.pass(label); else perform pg_temp.fail(label,'etkilenen='||n||' beklenen='||expected); end if;
 exception when others then perform pg_temp.fail(label,sqlerrm); end;
end; $$;
-- SELECT sonucu (tek değer, metin) beklenen olmalı
create function pg_temp.val(label text, q text, expected text) returns void language plpgsql as $$
declare v text;
begin
 begin execute q into v;
  if v is not distinct from expected then perform pg_temp.pass(label); else perform pg_temp.fail(label,'değer='||coalesce(v,'NULL')||' beklenen='||coalesce(expected,'NULL')); end if;
 exception when others then perform pg_temp.fail(label,sqlerrm); end;
end; $$;

-- DML çalıştırır, sonucu sorgular, sonra alt işlemi geri alır (kalıcı değişiklik bırakmaz)
create function pg_temp.probe(label text, dml text, chk text, expected text) returns void language plpgsql as $$
declare v text;
begin
 begin
  execute dml; execute chk into v;
  raise exception '__probe__%',coalesce(v,'NULL');
 exception when others then
  if sqlerrm like '__probe__%' then v:=substr(sqlerrm,10);
   if v is not distinct from expected then perform pg_temp.pass(label); else perform pg_temp.fail(label,'değer='||v||' beklenen='||expected); end if;
  else perform pg_temp.fail(label,sqlerrm); end if;
 end;
end; $$;

-- Sabit kimlikler ---------------------------------------------------------------------------------------------
create function pg_temp.id(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
-- 1 admin, 2 müşteri A, 3 müşteri B, 4 işletme sahibi X, 5 işletme sahibi Y, 6 doğrulanmamış kullanıcı, 7 onaysız işletme hesabı Z
-- 11 işletme X, 12 işletme Y, 21 menü ürünü, 31 reklam paketi, 32 kampanya paketi


-- BASELINE-ONLY: yalnızca 20261001_baseline_inferred_schema.sql uygulanmış (sonraki migration'lar YOK) veritabanı için.
-- 1 admin, 2 müşteri, 3 işletme sahibi, 11 işletme, 21 ürün
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 (pg_temp.id(1),'caddeden.app@gmail.com','{}',now()),
 (pg_temp.id(2),'a@example.test','{}',now()),
 (pg_temp.id(3),'x@example.test','{"role":"business"}',now());
select pg_temp.act(pg_temp.id(3));
select pg_temp.allowed('sahibi işletmesini ekler',$q$insert into public.businesses(id,owner_id,category,main_category,name,phone,address,hours,allow_order,allow_menu,min_order) values(pg_temp.id(11),pg_temp.id(3),'restoran','yeme_icme','X','5551234567','adres','09:00-23:00',true,true,20)$q$);
select pg_temp.allowed('sahibi ürün ekler',$q$insert into public.menu_items(id,business_id,name,price) values(pg_temp.id(21),pg_temp.id(11),'Çorba',50)$q$);
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('onaysız işletmeye sipariş verilemez',$q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng) values(pg_temp.id(2),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'qty',1)),50,'5551234567','adres',41,29)$q$);
select pg_temp.act(null,'service_role');
select pg_temp.allowed('servis rolü işletmeyi onaylar',$q$update public.businesses set approval_status='approved',is_published=true where id=pg_temp.id(11)$q$);
select pg_temp.act(pg_temp.id(2));
select pg_temp.allowed('müşteri sipariş verir: sahte ad/fiyat/toplam/durum',
 $q$insert into public.orders(id,user_id,business_id,items,total,phone,address,lat,lng,status)
 values(pg_temp.id(41),pg_temp.id(2),pg_temp.id(11),
 jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'name','HACKED','price',0.01,'qty',1),jsonb_build_object('menu_item_id',pg_temp.id(21),'price',0,'qty',1)),
 0.01,'5551234567','adres',41,29,'delivered')$q$);
select pg_temp.val('fiyat sunucudan: toplam 2 x 50',$q$select total::text from public.orders where id=pg_temp.id(41)$q$,'100.00');
select pg_temp.val('ad sunucudan',$q$select items->0->>'name' from public.orders where id=pg_temp.id(41)$q$,'Çorba');
select pg_temp.val('birim fiyat sunucudan',$q$select items->0->>'price' from public.orders where id=pg_temp.id(41)$q$,'50.00');
select pg_temp.val('durum pending',$q$select status from public.orders where id=pg_temp.id(41)$q$,'pending');
select pg_temp.denied('minimum sipariş altında',$q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng) values(pg_temp.id(2),pg_temp.id(11),'[{"menu_item_id":"00000000-0000-4000-8000-000000000015","qty":0}]'::jsonb,0,'5551234567','adres',41,29)$q$);
select pg_temp.denied('başkası adına sipariş',$q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng) values(pg_temp.id(3),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'qty',1)),50,'5551234567','adres',41,29)$q$);
select pg_temp.val('müşteri siparişin durumunu değiştiremez (0 satır)',$q$with u as (update public.orders set status='approved' where id=pg_temp.id(41) returning 1) select count(*)::text from u$q$,'0');
select pg_temp.denied('müşteri toplam sütununu güncelleyemez',$q$update public.orders set total=1 where id=pg_temp.id(41)$q$);
select pg_temp.denied('müşteri silemez',$q$delete from public.orders where id=pg_temp.id(41)$q$);
select pg_temp.act(pg_temp.id(3));
select pg_temp.denied('pending -> delivered atlanamaz',$q$update public.orders set status='delivered' where id=pg_temp.id(41)$q$);
select pg_temp.allowed('pending -> approved',$q$update public.orders set status='approved' where id=pg_temp.id(41)$q$);
select pg_temp.denied('approved -> delivered atlanamaz',$q$update public.orders set status='delivered' where id=pg_temp.id(41)$q$);
select pg_temp.allowed('approved -> on_the_way',$q$update public.orders set status='on_the_way' where id=pg_temp.id(41)$q$);
select pg_temp.allowed('on_the_way -> delivered',$q$update public.orders set status='delivered' where id=pg_temp.id(41)$q$);
select pg_temp.denied('delivered geri alınamaz',$q$update public.orders set status='pending' where id=pg_temp.id(41)$q$);
select pg_temp.denied('sahibi kendi işletmesini silemez',$q$delete from public.businesses where id=pg_temp.id(11)$q$);
select pg_temp.act(null,'service_role');
select pg_temp.denied('siparişli işletme servis rolüyle de silinemez (RESTRICT)',$q$delete from public.businesses where id=pg_temp.id(11)$q$);
select pg_temp.probe('müşteri profili silinse sipariş kalır (user_id NULL)',$q$delete from public.user_profiles where id=pg_temp.id(2)$q$,$q$select count(*)::text from public.orders where user_id is null$q$,'1');
select pg_temp.denied('servis rolü başka hesaba admin veremez',$q$update public.user_profiles set role='admin' where id=pg_temp.id(2)$q$);
select pg_temp.su();
select pg_temp.val('admin yalnızca doğrulanmış yetkili e-postada',$q$select role from public.user_profiles where id=pg_temp.id(1)$q$,'admin');
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri kendi rolünü admin yapamaz',$q$update public.user_profiles set role='admin' where id=pg_temp.id(2)$q$);

select pg_temp.su();
do $$ begin
 raise notice '== TOPLAM: PASS=% FAIL=%',current_setting('t.pass'),current_setting('t.fail');
 if current_setting('t.fail')::int>0 then raise exception 'Duman testi başarısız: % hata',current_setting('t.fail'); end if;
end $$;
rollback;

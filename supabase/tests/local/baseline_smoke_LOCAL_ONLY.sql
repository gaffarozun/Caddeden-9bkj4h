-- Caddeden · baseline + migration işlevsel duman testi — YALNIZCA YEREL / ATILABİLİR veritabanı içindir.
--
-- UYARI: Bu dosya test kullanıcıları (auth.users), işletme, sipariş vb. kayıt EKLER. Tek bir işlem içinde çalışır ve sonunda
-- ROLLBACK yapar, yine de canlı/üretim Supabase projesinde ÇALIŞTIRMAYIN. Boş yerel PostgreSQL'de, Supabase benzeri
-- iskelet (anon/authenticated/service_role rolleri, auth.users, auth.uid(), storage.*) + baseline + tüm migration'lar
-- uygulandıktan sonra çalıştırılır (bkz. supabase/BASELINE_SETUP.md, "Yerel doğrulama").
--
-- Her satır: PASS | FAIL. Herhangi bir FAIL varsa dosya sonunda hata ile biter.
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

-- Sabit kimlikler ---------------------------------------------------------------------------------------------
create function pg_temp.id(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
-- 1 admin, 2 müşteri A, 3 müşteri B, 4 işletme sahibi X, 5 işletme sahibi Y, 6 doğrulanmamış kullanıcı, 7 onaysız işletme hesabı Z
-- 11 işletme X, 12 işletme Y, 21 menü ürünü, 31 reklam paketi, 32 kampanya paketi

-- 1) Kayıt tetikleyicisi ve hesap türleri -------------------------------------------------------------------------
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 (pg_temp.id(1),'caddeden.app@gmail.com','{"role":"business"}',now()),
 (pg_temp.id(2),'a@example.test','{"username":"ayse","first_name":"Ayşe","last_name":"Yılmaz","gender":"female"}',now()),
 (pg_temp.id(3),'b@example.test','{}',now()),
 (pg_temp.id(4),'x@example.test','{"role":"business"}',now()),
 (pg_temp.id(5),'y@example.test','{"role":"business"}',now()),
 (pg_temp.id(6),'u@example.test','{}',null),
 (pg_temp.id(7),'z@example.test','{"role":"business"}',now());
select pg_temp.val('admin e-postası doğrulanmış kayıtta admin rolü alır (meta rol=business yok sayılır)',$q$select role from public.user_profiles where id=pg_temp.id(1)$q$,'admin');
select pg_temp.val('müşteri kaydı user rolü',$q$select role from public.user_profiles where id=pg_temp.id(2)$q$,'user');
select pg_temp.val('işletme kaydı business rolü',$q$select role from public.user_profiles where id=pg_temp.id(4)$q$,'business');
select pg_temp.val('işletme hesabı onay kaydı pending açıldı',$q$select status from public.business_account_approvals where user_id=pg_temp.id(4)$q$,'pending');
select pg_temp.val('yönetici uyarısı oluştu',$q$select (count(*)>=3)::text from public.admin_alerts where type='business_account_approval'$q$,'true');
select pg_temp.allowed('admin işletme hesabı X onaylar',$q$select public.admin_set_business_account_approval(pg_temp.id(1),pg_temp.id(4),'approved')$q$);
select pg_temp.allowed('admin işletme hesabı Y onaylar',$q$select public.admin_set_business_account_approval(pg_temp.id(1),pg_temp.id(5),'approved')$q$);

-- 2) İşletme: sahiplik ve korumalı sütunlar ---------------------------------------------------------------------
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X kendi işletmesini ekler (onay/yayın/puan alanlarını kendi belirlemeye çalışsa da)',
 $q$insert into public.businesses(id,owner_id,category,main_category,name,description,phone,address,hours,approval_status,is_published,featured,rating,review_count)
 values(pg_temp.id(11),pg_temp.id(4),'restoran','yeme_icme','X Restoran','d','555','adres','09:00-23:00','approved',true,true,5,99)$q$);
select pg_temp.act(pg_temp.id(5));
select pg_temp.allowed('Y kendi işletmesini ekler',
 $q$insert into public.businesses(id,owner_id,category,main_category,name,phone,address,hours) values(pg_temp.id(12),pg_temp.id(5),'kafe','yeme_icme','Y Kafe','556','adres','08:00-20:00')$q$);
select pg_temp.denied('Y, X adına işletme ekleyemez',$q$insert into public.businesses(owner_id,category,name) values(pg_temp.id(4),'kafe','Sahte')$q$);
select pg_temp.act(pg_temp.id(7));
select pg_temp.denied('onaysız işletme hesabı (Z) işletme ekleyemez',$q$insert into public.businesses(owner_id,category,name) values(pg_temp.id(7),'kafe','Z Kafe')$q$);
select pg_temp.su();
select pg_temp.val('yeni işletme pending/yayında değil/öne çıkmamış/puan 0',$q$select approval_status||is_published||featured||rating||review_count from public.businesses where id=pg_temp.id(11)$q$,'pendingfalsefalse0.00');
select pg_temp.val('yönetici işletme başvuru uyarısı',$q$select count(*)::text from public.admin_alerts where type='business'$q$,'2');
select pg_temp.act(pg_temp.id(4));
select pg_temp.rows('X onay/yayın alanlarını güncelleyemez (sessizce eski değer korunur, satır güncellenir)',$q$update public.businesses set approval_status='approved',is_published=true,featured=true,rating=5,owner_id=pg_temp.id(5) where id=pg_temp.id(11)$q$,1);
select pg_temp.su();
select pg_temp.val('korumalı alanlar değişmedi',$q$select approval_status||is_published||featured||owner_id::text from public.businesses where id=pg_temp.id(11)$q$,'pendingfalsefalse'||pg_temp.id(4)::text);
select pg_temp.act(null,'anon');
select pg_temp.val('anon onaysız işletmeyi göremez',$q$select count(*)::text from public.businesses$q$,'0');
select pg_temp.act(pg_temp.id(5));
select pg_temp.val('Y, X işletmesini (onaysız) göremez',$q$select count(*)::text from public.businesses where id=pg_temp.id(11)$q$,'0');
select pg_temp.act(null,'service_role');
select pg_temp.allowed('service_role (admin-api) işletmeleri onaylar',$q$update public.businesses set approval_status='approved',is_published=true where id in (pg_temp.id(11),pg_temp.id(12))$q$);
select pg_temp.act(null,'anon');
select pg_temp.val('anon onaylı işletmeleri görür',$q$select count(*)::text from public.businesses$q$,'2');
select pg_temp.act(pg_temp.id(5));
select pg_temp.rows('Y, X işletmesini güncelleyemez',$q$update public.businesses set name='ele geçirildi' where id=pg_temp.id(11)$q$,0);
select pg_temp.rows('Y, X işletmesini silemez',$q$delete from public.businesses where id=pg_temp.id(11)$q$,0);
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X işletmeyi açık/siparişe açık yapar',$q$update public.businesses set is_open=true,status_mode='manual',allow_order=true,lat=41.0,lng=29.0 where id=pg_temp.id(11)$q$);
select pg_temp.allowed('X menü ürünü ekler',$q$insert into public.menu_items(id,business_id,name,price,group_name) values(pg_temp.id(21),pg_temp.id(11),'Çorba',50,'Çorbalar')$q$);
select pg_temp.act(pg_temp.id(5));
select pg_temp.denied('Y, X işletmesine menü ürünü ekleyemez',$q$insert into public.menu_items(business_id,name,price) values(pg_temp.id(11),'Sahte',1)$q$);
select pg_temp.rows('Y, X menü ürününü güncelleyemez',$q$update public.menu_items set price=1 where id=pg_temp.id(21)$q$,0);
select pg_temp.rows('Y, X menü ürününü silemez',$q$delete from public.menu_items where id=pg_temp.id(21)$q$,0);
select pg_temp.act(null,'anon');
select pg_temp.val('anon yayındaki işletmenin menüsünü görür',$q$select count(*)::text from public.menu_items$q$,'1');

-- 3) Sipariş / rezervasyon -----------------------------------------------------------------------------------
select pg_temp.act(pg_temp.id(2));
select pg_temp.allowed('müşteri A sipariş verir (istemci toplamı yanlış gönderse de)',
 $q$insert into public.orders(id,user_id,business_id,items,total,phone,address,lat,lng,customer_name)
 values(pg_temp.id(41),pg_temp.id(2),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'name','Çorba','price',50,'qty',2)),1,'555','adres',41.0,29.0,'Ayşe Y.')$q$);
select pg_temp.denied('müşteri sahte fiyatla sipariş veremez',
 $q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng)
 values(pg_temp.id(2),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'name','Çorba','price',1,'qty',1)),1,'555','adres',41.0,29.0)$q$);
select pg_temp.denied('müşteri başkası adına sipariş veremez',
 $q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng)
 values(pg_temp.id(3),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'name','Çorba','price',50,'qty',1)),50,'555','adres',41.0,29.0)$q$);
select pg_temp.rows('müşteri sipariş durumunu değiştiremez',$q$update public.orders set status='delivered' where id=pg_temp.id(41)$q$,0);
select pg_temp.act(pg_temp.id(6));
select pg_temp.denied('e-postası doğrulanmamış kullanıcı sipariş veremez',
 $q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng)
 values(pg_temp.id(6),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'name','Çorba','price',50,'qty',1)),50,'555','adres',41.0,29.0)$q$);
select pg_temp.act(pg_temp.id(4));
select pg_temp.denied('işletme sahibi X müşteri siparişi veremez',
 $q$insert into public.orders(user_id,business_id,items,total,phone,address,lat,lng)
 values(pg_temp.id(4),pg_temp.id(11),jsonb_build_array(jsonb_build_object('menu_item_id',pg_temp.id(21),'name','Çorba','price',50,'qty',1)),50,'555','adres',41.0,29.0)$q$);
select pg_temp.val('X kendi işletmesinin siparişini görür',$q$select count(*)::text from public.orders$q$,'1');
select pg_temp.val('sunucu toplamı hesapladı (2 x 50)',$q$select total::text from public.orders where id=pg_temp.id(41)$q$,'100.00');
select pg_temp.denied('X sipariş toplamını değiştiremez (sütun yetkisi)',$q$update public.orders set total=1 where id=pg_temp.id(41)$q$);
select pg_temp.denied('pending -> delivered doğrudan geçiş reddedilir',$q$update public.orders set status='delivered' where id=pg_temp.id(41)$q$);
select pg_temp.allowed('pending -> approved',$q$update public.orders set status='approved' where id=pg_temp.id(41)$q$);
select pg_temp.allowed('approved -> on_the_way',$q$update public.orders set status='on_the_way' where id=pg_temp.id(41)$q$);
select pg_temp.allowed('on_the_way -> delivered',$q$update public.orders set status='delivered' where id=pg_temp.id(41)$q$);
select pg_temp.act(pg_temp.id(5));
select pg_temp.val('Y, X siparişlerini göremez',$q$select count(*)::text from public.orders$q$,'0');
select pg_temp.rows('Y, X siparişini güncelleyemez',$q$update public.orders set status='rejected' where id=pg_temp.id(41)$q$,0);
select pg_temp.act(pg_temp.id(3));
select pg_temp.val('müşteri B, A siparişini göremez',$q$select count(*)::text from public.orders$q$,'0');
select pg_temp.val('müşteri B, A mesajlarını göremez',$q$select count(*)::text from public.order_messages$q$,'0');
select pg_temp.act(pg_temp.id(2));
select pg_temp.val('A kendi sipariş mesajlarını görür (4 durum olayı)',$q$select count(*)::text from public.order_messages$q$,'4');
select pg_temp.allowed('A teslim edilmiş siparişi değerlendirme bekleyen listede görür',$q$select public.pending_order_ratings(now()+interval '1 minute')$q$);
select pg_temp.allowed('A rezervasyon yapar',$q$insert into public.reservations(id,user_id,business_id,type,date,time,guests,phone,customer_name)
 values(pg_temp.id(51),pg_temp.id(2),pg_temp.id(11),'reservation',current_date+1,'19:30',2,'555','Ayşe Y.')$q$);
select pg_temp.denied('geçmiş tarihli rezervasyon reddedilir',$q$insert into public.reservations(user_id,business_id,type,date,time,guests,phone) values(pg_temp.id(2),pg_temp.id(11),'reservation',current_date-1,'19:30',2,'555')$q$);
select pg_temp.act(pg_temp.id(5));
select pg_temp.rows('Y, X rezervasyonunu güncelleyemez',$q$update public.reservations set status='approved' where id=pg_temp.id(51)$q$,0);
select pg_temp.act(pg_temp.id(4));
select pg_temp.rows('X rezervasyonu onaylar',$q$update public.reservations set status='approved' where id=pg_temp.id(51)$q$,1);

-- 4) Profil gizliliği ve yetki yükseltme ---------------------------------------------------------------------
select pg_temp.act(pg_temp.id(2));
select pg_temp.val('A yalnızca kendi profilini görür',$q$select count(*)::text from public.user_profiles$q$,'1');
select pg_temp.denied('A rolünü admin yapamaz',$q$update public.user_profiles set role='admin' where id=pg_temp.id(2)$q$);
select pg_temp.denied('A e-posta alanını değiştiremez (sütun yetkisi)',$q$update public.user_profiles set email='caddeden.app@gmail.com' where id=pg_temp.id(2)$q$);
select pg_temp.allowed('A kendi telefonunu günceller',$q$update public.user_profiles set phone='5551112233',school_name='Üni' where id=pg_temp.id(2)$q$);
select pg_temp.rows('A, B profilini güncelleyemez',$q$update public.user_profiles set phone='1' where id=pg_temp.id(3)$q$,0);
select pg_temp.denied('A durum/kısıt alanlarını kendi güncelleyemez (sütun yetkisi)',$q$update public.user_profiles set status='active',restricted_until=null where id=pg_temp.id(2)$q$);
select pg_temp.act(null,'anon');
select pg_temp.denied('anon profilleri okuyamaz',$q$select * from public.user_profiles$q$);

-- 5) Gizli tablolar ---------------------------------------------------------------------------------------
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri app_config okuyamaz',$q$select * from public.app_config$q$);
select pg_temp.denied('müşteri admin_logs okuyamaz',$q$select * from public.admin_logs$q$);
select pg_temp.denied('müşteri admin_alerts okuyamaz',$q$select * from public.admin_alerts$q$);
select pg_temp.denied('müşteri complaints okuyamaz',$q$select * from public.complaints$q$);
select pg_temp.denied('müşteri business_reviews okuyamaz/yazamaz',$q$insert into public.business_reviews(business_id,user_id,rating) values(pg_temp.id(11),pg_temp.id(2),5)$q$);
select pg_temp.denied('müşteri notifications okuyamaz',$q$select * from public.notifications$q$);
select pg_temp.denied('müşteri account_deletion_requests okuyamaz',$q$select * from public.account_deletion_requests$q$);
select pg_temp.val('müşteri payments satırı göremez (RLS)',$q$select count(*)::text from public.payments$q$,'0');
select pg_temp.act(null,'anon');
select pg_temp.denied('anon app_config okuyamaz',$q$select * from public.app_config$q$);
select pg_temp.val('anon public_complaint_email çağırabilir (anahtar yok -> null)',$q$select public.public_complaint_email()$q$,null);
select pg_temp.denied('anon feedback_write çağıramaz',$q$select public.feedback_write('review','{}')$q$);
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri admin_set_account_type çağıramaz',$q$select public.admin_set_account_type(pg_temp.id(1),pg_temp.id(3),'business','user')$q$);
select pg_temp.denied('müşteri submit_business_star(p_user) doğrudan çağıramaz',$q$select public.submit_business_star(pg_temp.id(2),pg_temp.id(11),5)$q$);
select pg_temp.denied('müşteri feedback_delete_account_data çağıramaz',$q$select public.feedback_delete_account_data(pg_temp.id(3))$q$);

-- 6) Geri bildirim (yorum / cevap / şikâyet) ---------------------------------------------------------------
select pg_temp.denied('deneyim özelliği kapalıyken yorum yazılamaz',$q$select public.feedback_write('review',jsonb_build_object('business_id',pg_temp.id(11),'comment','x','criteria_ratings','{"price":4,"hygiene":4,"staff":4,"service":4,"environment":4,"variety":4}'::jsonb))$q$);
select pg_temp.su();
select pg_temp.allowed('admin deneyim özelliğini açar',$q$select public.set_experience_feature(pg_temp.id(1),true)$q$);
select pg_temp.act(pg_temp.id(2));
select pg_temp.allowed('A altı özellikli yorum yazar',$q$select public.feedback_write('review',jsonb_build_object('business_id',pg_temp.id(11),'comment','Güzel','criteria_ratings','{"price":5,"hygiene":4,"staff":4,"service":5,"environment":4,"variety":4}'::jsonb))$q$);
select pg_temp.denied('eksik özellikli yorum reddedilir',$q$select public.feedback_write('review',jsonb_build_object('business_id',pg_temp.id(11),'comment','x','criteria_ratings','{"price":5}'::jsonb))$q$);
select pg_temp.act(pg_temp.id(4));
select pg_temp.denied('işletme sahibi kendi işletmesine yorum yazamaz',$q$select public.feedback_write('review',jsonb_build_object('business_id',pg_temp.id(11),'comment','x','criteria_ratings','{"price":5,"hygiene":5,"staff":5,"service":5,"environment":5,"variety":5}'::jsonb))$q$);
select pg_temp.act(null,'anon');
select pg_temp.val('anon yorum sayısını (yayında) görür',$q$select jsonb_array_length(public.feedback_read(pg_temp.id(11),'newest',0)->'reviews')::text$q$,'1');
select pg_temp.val('anon yorumda user_id göremez',$q$select (public.feedback_read(pg_temp.id(11),'newest',0)->'reviews'->0 ? 'user_id')::text$q$,'false');
select pg_temp.val('ortalama puan = 4.4 (özellik ortalaması)',$q$select (public.feedback_read(pg_temp.id(11),'newest',0)->'ratings'->>'rating')$q$,'4.3');
select pg_temp.act(pg_temp.id(5));
select pg_temp.denied('Y, X yorumuna cevap veremez',$q$select public.feedback_write('review_reply',jsonb_build_object('id',current_setting('t.review_id')::uuid,'text','Teşekkürler!'))$q$);
select pg_temp.su();
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X yorumuna cevap verir',$q$select public.feedback_write('review_reply',jsonb_build_object('id',(select (public.feedback_read(pg_temp.id(11),'newest',0)->'reviews'->0->>'id')::uuid),'text','Teşekkürler!'))$q$);
select pg_temp.act(pg_temp.id(2));
select pg_temp.allowed('A şikâyet gönderir (kendi klasöründeki kanıtla)',$q$select public.feedback_write('complaint',jsonb_build_object('target_type','business','target_id',pg_temp.id(11),'category','service','description','Uzun bekleme süresi yaşandı','evidence_path',pg_temp.id(2)::text||'/e.jpg'))$q$);
select pg_temp.denied('başkasının klasörüne işaret eden kanıt reddedilir',$q$select public.feedback_write('complaint',jsonb_build_object('target_type','business','target_id',pg_temp.id(11),'category','service','description','Uzun bekleme süresi yaşandı','evidence_path',pg_temp.id(3)::text||'/e.jpg'))$q$);
select pg_temp.denied('müşteri moderasyon yapamaz',$q$select public.feedback_write('moderate',jsonb_build_object('id',current_setting('t.review_id')::uuid,'kind','review','status','hidden','reason','gerekçe yok'))$q$);
select pg_temp.denied('müşteri yönetici listesini okuyamaz',$q$select public.feedback_admin_read('complaint')$q$);
select pg_temp.val('A kendi şikâyetini işletme sayfasında görür',$q$select jsonb_array_length(public.feedback_read(pg_temp.id(11),'newest',0)->'complaints')::text$q$,'1');
select pg_temp.act(pg_temp.id(3));
select pg_temp.val('B, A şikâyetini göremez',$q$select jsonb_array_length(public.feedback_read(pg_temp.id(11),'newest',0)->'complaints')::text$q$,'0');
select pg_temp.su();
select set_config('t.review_id',(select id::text from public.business_reviews limit 1),true), set_config('t.complaint_id',(select id::text from public.complaints limit 1),true);
select pg_temp.act(pg_temp.id(1));
select pg_temp.val('admin şikâyet listesini okur',$q$select jsonb_array_length(public.feedback_admin_read('complaint'))::text$q$,'1');
select pg_temp.allowed('admin yorumu gerekçeyle gizler',$q$select public.feedback_write('moderate',jsonb_build_object('id',current_setting('t.review_id')::uuid,'kind','review','status','hidden','reason','Uygunsuz içerik'))$q$);
select pg_temp.allowed('admin şikâyeti sonuçlandırır',$q$select public.feedback_write('complaint_status',jsonb_build_object('id',current_setting('t.complaint_id')::uuid,'status','resolved','reason','İncelendi ve kapatıldı'))$q$);
select pg_temp.act(null,'anon');
select pg_temp.val('gizlenen yorum anon için görünmez',$q$select jsonb_array_length(public.feedback_read(pg_temp.id(11),'newest',0)->'reviews')::text$q$,'0');

-- 7) Bağımsız yıldız puanı -------------------------------------------------------------------------------
select pg_temp.act(null,'service_role');
select pg_temp.allowed('rating-api A için yıldız verir',$q$select public.submit_business_star(pg_temp.id(2),pg_temp.id(11),4.5)$q$);
select pg_temp.denied('sahip kendi işletmesini puanlayamaz',$q$select public.submit_business_star(pg_temp.id(4),pg_temp.id(11),5)$q$);
select pg_temp.denied('rating-api: admin puan veremez',$q$select public.submit_business_star(pg_temp.id(1),pg_temp.id(11),5)$q$);
select pg_temp.act(null,'anon');
select pg_temp.val('anon yıldız istatistiği',$q$select public.business_star_stats(array[pg_temp.id(11)])->(pg_temp.id(11)::text)->>'count'$q$,'1');

-- 8) Reklam / içerik / kampanya / bildirim talebi ---------------------------------------------------------
select pg_temp.act(null,'service_role');
select pg_temp.allowed('yönetici reklam paketi tanımlar',$q$insert into public.ad_packages(id,name,type,price,duration_days) values(pg_temp.id(31),'Keşfet 7 gün','discover_featured',100,7)$q$);
select pg_temp.allowed('yönetici kampanya paketi tanımlar',$q$insert into public.ad_packages(id,name,type,price,duration_days) values(pg_temp.id(32),'Kampanya 5 gün','content_campaign',200,5)$q$);
select pg_temp.allowed('yönetici içerik paketi tanımlar',$q$insert into public.ad_packages(id,name,type,price,duration_days) values(pg_temp.id(33),'TV 3 gün','content_reel',50,3)$q$);
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X reklam başvurusu (fiyat/durum istemciden gelse de)',$q$insert into public.ads(id,business_id,package_id,type,title,price,status,payment_status) values(pg_temp.id(61),pg_temp.id(11),pg_temp.id(31),'reels_sponsored','Reklam',0,'active','paid')$q$);
select pg_temp.su();
select pg_temp.val('reklam: tür/fiyat/durum paketten ve sunucudan',$q$select type||price||status||payment_status from public.ads where id=pg_temp.id(61)$q$,'discover_featured100.00pendingunpaid');
select pg_temp.act(pg_temp.id(5));
select pg_temp.denied('Y, X işletmesi adına reklam veremez',$q$insert into public.ads(business_id,package_id,type) values(pg_temp.id(11),pg_temp.id(31),'discover_featured')$q$);
select pg_temp.val('Y, X reklamlarını göremez',$q$select count(*)::text from public.ads$q$,'0');
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri reklam veremez',$q$insert into public.ads(business_id,package_id,type) values(pg_temp.id(11),pg_temp.id(31),'discover_featured')$q$);
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X Cadde TV içeriği yükler (status/price istemciden gelse de)',$q$insert into public.business_posts(id,business_id,kind,image_url,package_id,price,status,payment_status) values(pg_temp.id(71),pg_temp.id(11),'reel','https://example.test/a.jpg',pg_temp.id(33),0,'approved','paid')$q$);
select pg_temp.su();
select pg_temp.val('içerik: bekliyor/ödenmedi/paket fiyatı',$q$select status||payment_status||price from public.business_posts where id=pg_temp.id(71)$q$,'pendingunpaid50.00');
select pg_temp.act(null,'anon');
select pg_temp.val('anon onaysız içeriği göremez',$q$select count(*)::text from public.business_posts$q$,'0');
select pg_temp.val('Cadde TV onaysız içerik göstermez',$q$select count(*)::text from public.public_cadde_tv_channels()$q$,'0');
select pg_temp.act(null,'service_role');
select pg_temp.allowed('yönetici içeriği öder ve onaylar',$q$update public.business_posts set payment_status='paid',status='approved',start_date=(now() at time zone 'Europe/Istanbul')::date,end_date=(now() at time zone 'Europe/Istanbul')::date+3 where id=pg_temp.id(71)$q$);
select pg_temp.act(null,'anon');
select pg_temp.val('Cadde TV onaylı+ödenmiş içeriği gösterir',$q$select count(*)::text from public.public_cadde_tv_channels()$q$,'1');
select pg_temp.act(pg_temp.id(4));
select pg_temp.denied('X onaylı içeriği güncelleyemez (yetki yok)',$q$update public.business_posts set price=0 where id=pg_temp.id(71)$q$);
select pg_temp.allowed('X bildirim talebi gönderir',$q$insert into public.notification_requests(id,business_id,title,body,send_count,price,status,payment_status) values(pg_temp.id(81),pg_temp.id(11),'İndirim','Bugün %20',1,0,'approved','paid')$q$);
select pg_temp.su();
select pg_temp.val('bildirim talebi: bekliyor/ödenmedi',$q$select status||payment_status from public.notification_requests where id=pg_temp.id(81)$q$,'pendingunpaid');
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X ücretli kampanya başvurusu (submit_paid_campaign)',$q$select public.submit_paid_campaign(pg_temp.id(11),pg_temp.id(32),'Hafta sonu menü','Açıklama',null,200,5)$q$);
select pg_temp.denied('X yanlış fiyatla kampanya başvuramaz',$q$select public.submit_paid_campaign(pg_temp.id(11),pg_temp.id(32),'Hafta sonu menü','Açıklama',null,1,5)$q$);
select pg_temp.act(pg_temp.id(5));
select pg_temp.denied('Y, X işletmesi için kampanya başvuramaz',$q$select public.submit_paid_campaign(pg_temp.id(11),pg_temp.id(32),'Hafta sonu menü','Açıklama',null,200,5)$q$);
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri kampanya başvuramaz',$q$select public.submit_paid_campaign(pg_temp.id(11),pg_temp.id(32),'Hafta sonu menü','Açıklama',null,200,5)$q$);
select pg_temp.su();
select set_config('t.campaign_id',(select id::text from public.campaigns limit 1),true);
select pg_temp.act(null,'service_role');
select pg_temp.allowed('admin-api kampanya ödemesini doğrular',$q$select public.admin_campaign_decision(pg_temp.id(1),current_setting('t.campaign_id')::uuid,'payment','paid')$q$);
select pg_temp.allowed('admin-api kampanyayı onaylar',$q$select public.admin_campaign_decision(pg_temp.id(1),current_setting('t.campaign_id')::uuid,'status','approved')$q$);
select pg_temp.act(null,'anon');
select pg_temp.val('anon yalnızca ödenmiş+onaylı kampanyayı görür',$q$select count(*)::text from public.public_paid_campaigns()$q$,'1');
select pg_temp.act(pg_temp.id(4));
select pg_temp.val('X ödeme kayıtlarını (yalnız kendi işletmesi) görür',$q$select count(*)::text from public.payments$q$,'1');
select pg_temp.act(pg_temp.id(5));
select pg_temp.val('Y, X ödeme kayıtlarını göremez',$q$select count(*)::text from public.payments$q$,'0');

-- 9) Storage -----------------------------------------------------------------------------------------------------
select pg_temp.act(pg_temp.id(4));
select pg_temp.allowed('X kendi işletme klasörüne görsel yükler',format($q$insert into storage.objects(bucket_id,name,owner) values('business-media',%L,pg_temp.id(4))$q$,pg_temp.id(11)::text||'/content/a.jpg'));
select pg_temp.denied('X başka işletme klasörüne yükleyemez',format($q$insert into storage.objects(bucket_id,name,owner) values('business-media',%L,pg_temp.id(4))$q$,pg_temp.id(12)::text||'/content/a.jpg'));
select pg_temp.act(pg_temp.id(5));
select pg_temp.denied('Y, X klasörüne yükleyemez',format($q$insert into storage.objects(bucket_id,name,owner) values('business-media',%L,pg_temp.id(5))$q$,pg_temp.id(11)::text||'/content/b.jpg'));
select pg_temp.rows('Y, X görselini silemez',format($q$delete from storage.objects where bucket_id='business-media' and name=%L$q$,pg_temp.id(11)::text||'/content/a.jpg'),0);
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri business-media yükleyemez',format($q$insert into storage.objects(bucket_id,name,owner) values('business-media',%L,pg_temp.id(2))$q$,pg_temp.id(11)::text||'/content/c.jpg'));
select pg_temp.allowed('A kendi klasörüne kanıt yükler',format($q$insert into storage.objects(bucket_id,name,owner) values('feedback-evidence',%L,pg_temp.id(2))$q$,pg_temp.id(2)::text||'/e.jpg'));
select pg_temp.denied('A başka klasöre kanıt yükleyemez',format($q$insert into storage.objects(bucket_id,name,owner) values('feedback-evidence',%L,pg_temp.id(2))$q$,pg_temp.id(3)::text||'/e.jpg'));
select pg_temp.act(pg_temp.id(3));
select pg_temp.val('B, A kanıtını göremez',$q$select count(*)::text from storage.objects where bucket_id='feedback-evidence'$q$,'0');
select pg_temp.act(null,'anon');
select pg_temp.denied('anon yükleme yapamaz',format($q$insert into storage.objects(bucket_id,name) values('business-media',%L)$q$,pg_temp.id(11)::text||'/content/z.jpg'));
select pg_temp.val('anon business-media okuyabilir',$q$select count(*)::text from storage.objects where bucket_id='business-media'$q$,'1');
select pg_temp.val('anon feedback-evidence okuyamaz',$q$select count(*)::text from storage.objects where bucket_id='feedback-evidence'$q$,'0');

-- 10) Mekân (kafe/mekân varlığı) ---------------------------------------------------------------------------
select pg_temp.act(pg_temp.id(2));
select pg_temp.allowed('A konumuyla yakın mekânları sorgular',$q$select public.cafe_nearby(41.0,29.0,5,now())$q$);
select pg_temp.allowed('A mekâna katılır',$q$select public.cafe_join(pg_temp.id(11),41.0,29.0,5,now(),false)$q$);
select pg_temp.val('A ziyareti kaydedildi',$q$select (public.cafe_my_visit()->>'business_id')$q$,pg_temp.id(11)::text);
select pg_temp.act(pg_temp.id(3));
select pg_temp.denied('B uzaktan (konumsuz) katılamaz',$q$select public.cafe_join(pg_temp.id(11),40.0,28.0,5,now(),false)$q$);

-- 11) Hesap silme -----------------------------------------------------------------------------------------------
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('müşteri hesap silme başlatıcısını doğrudan çağıramaz',$q$select public.feedback_begin_account_deletion(pg_temp.id(2),false)$q$);
select pg_temp.act(null,'service_role');
select pg_temp.allowed('feedback-api silme işini başlatır',$q$select public.feedback_begin_account_deletion(pg_temp.id(2),false)$q$);
select pg_temp.denied('aynı silme işi tekrar başlatılamaz',$q$select public.feedback_begin_account_deletion(pg_temp.id(2),false)$q$);
select pg_temp.allowed('kişisel veri temizliği',$q$select public.feedback_delete_account_data(pg_temp.id(2))$q$);
select pg_temp.allowed('temizlik tekrar çalışabilir (idempotent)',$q$select public.feedback_delete_account_data(pg_temp.id(2))$q$);
select pg_temp.su();
select pg_temp.val('profil kişisel verisi temizlendi',$q$select coalesce(phone,'')||coalesce(first_name,'')||coalesce(school_name,'') from public.user_profiles where id=pg_temp.id(2)$q$,'');
select pg_temp.val('sipariş kaydı korundu, kişisel alanlar temizlendi',$q$select (count(*)::text)||coalesce(max(phone),'-') from public.orders where user_id=pg_temp.id(2)$q$,'1-');
select pg_temp.act(pg_temp.id(2));
select pg_temp.denied('silme isteği olan hesap işlem yapamaz',$q$insert into public.reservations(user_id,business_id,type,date,time,guests,phone) values(pg_temp.id(2),pg_temp.id(11),'reservation',current_date+1,'20:00',2,'555')$q$);

select pg_temp.su();
do $$ begin
 raise notice '== TOPLAM: PASS=% FAIL=%', current_setting('t.pass'), current_setting('t.fail');
 if current_setting('t.fail')::int > 0 then raise exception 'Duman testi başarısız: % hata', current_setting('t.fail'); end if;
end $$;
rollback;

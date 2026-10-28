-- Caddeden · BASELINE (temel şema) — uygulama kodundan ve mevcut 27 migration'dan ÇIKARILMIŞTIR.
--
-- DURUM: Bu dosya OnSpace kaynak veritabanından alınmış bir döküm DEĞİLDİR. Kaynak şemaya erişim yoktu.
-- Tablo/sütun/tür adları; services/, hooks/, supabase/functions/ ve supabase/migrations/ içindeki gerçek kullanımlardan
-- türetilmiştir. Kodda hiç kullanılmayan sütunlar eklenmedi. Kesin olmayan noktalar supabase/BASELINE_SETUP.md
-- içindeki "Doğrulanamayanlar" bölümünde listelenmiştir.
--
-- NE ZAMAN: BOŞ bir Supabase projesinde, diğer 27 migration'dan ÖNCE, yalnızca BİR KEZ çalıştırılır.
-- Mevcut 27 migration'ın doğru uygulama sırası: supabase/BASELINE_SETUP.md ve supabase/apply_order.txt.
--
-- Bu dosya hiçbir veriyi silmez veya sıfırlamaz. Aşağıdaki güvenlik kontrolü, migration'lar uygulandıktan sonra
-- yanlışlıkla yeniden çalıştırılırsa (yamalı fonksiyonların üzerine yazmamak için) işlemi durdurur.

begin;

do $guard$
begin
 if to_regprocedure('public.account_admin()') is not null
 or to_regclass('public.business_star_ratings') is not null
 or to_regclass('public.cafe_rooms') is not null then
  raise exception 'Baseline yalnızca migration''lardan ÖNCE çalıştırılır. Bu veritabanında migration nesneleri zaten var; baseline atlandı.';
 end if;
end;
$guard$;

-- ---------------------------------------------------------------------------------------------------------
-- 1) Ortak yardımcılar
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.updated_at:=now();
 return new;
end; $$;

-- ---------------------------------------------------------------------------------------------------------
-- 2) Tablolar
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.user_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text,
 email text,
 role text not null default 'user' check(role in ('user','business','admin')),
 status text not null default 'active' check(status in ('active','restricted','banned')),
 restricted_until timestamptz,
 first_name text,
 last_name text,
 gender text check(gender is null or gender in ('male','female')),
 phone text,
 address text,
 lat double precision,
 lng double precision,
 school_name text,
 education_status text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.app_config (
 key text primary key,
 value text not null default '',
 updated_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid references public.user_profiles(id) on delete set null,
 action text not null,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table if not exists public.admin_alerts (
 id uuid primary key default gen_random_uuid(),
 type text not null,
 ref_id uuid,
 title text not null,
 body text not null default '',
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);

create table if not exists public.businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.user_profiles(id) on delete cascade,
 main_category text,
 category text not null,
 name text not null check(char_length(btrim(name)) between 1 and 120),
 description text,
 logo_url text,
 cover_url text,
 images jsonb not null default '[]'::jsonb,
 phone text,
 email text,
 address text,
 lat double precision check(lat is null or lat between -90 and 90),
 lng double precision check(lng is null or lng between -180 and 180),
 hours text,
 status_mode text not null default 'manual' check(status_mode in ('auto','manual')),
 open_time text,
 close_time text,
 open_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
 is_open boolean not null default false,
 avg_delivery_minutes integer,
 allow_menu boolean not null default true,
 allow_reservation boolean not null default true,
 allow_order boolean not null default false,
 min_order numeric(12,2) not null default 0 check(min_order>=0),
 maps_url text,
 menu_cover_url text,
 menu_group_covers jsonb not null default '{}'::jsonb,
 profile_tags jsonb not null default '[]'::jsonb,
 approval_status text not null default 'pending' check(approval_status in ('pending','approved','rejected')),
 is_published boolean not null default false,
 featured boolean not null default false,
 rejection_reason text,
 rating numeric(3,1) not null default 0,
 review_count integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 group_name text,
 name text not null check(char_length(btrim(name)) between 1 and 160),
 description text,
 price numeric(12,2) not null default 0 check(price>=0),
 item_type text not null default 'product' check(item_type in ('product','service')),
 duration_min integer check(duration_min is null or duration_min>0),
 image_url text,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists public.ad_packages (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 type text not null,
 description text,
 price numeric(12,2) not null default 0 check(price>=0),
 duration_days integer not null default 30 check(duration_days>0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.ads (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 package_id uuid references public.ad_packages(id) on delete set null,
 type text not null check(type in ('discover_featured','reels_sponsored','posts_sponsored','category_featured','map_featured','home_promo','notification_promo')),
 title text,
 image_url text,
 price numeric(12,2) not null default 0 check(price>=0),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 status text not null default 'pending' check(status in ('pending','active','rejected','expired','paused')),
 start_date date,
 end_date date,
 rejection_reason text,
 created_at timestamptz not null default now()
);

create table if not exists public.business_posts (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 kind text not null check(kind in ('post','reel')),
 image_url text not null default '',
 caption text,
 package_id uuid references public.ad_packages(id) on delete set null,
 price numeric(12,2) not null default 0 check(price>=0),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 rejection_reason text,
 start_date date,
 end_date date,
 created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 package_id uuid references public.ad_packages(id) on delete set null,
 title text not null,
 description text,
 image_url text,
 price numeric(12,2) not null default 0 check(price>=0),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 rejection_reason text,
 start_date date,
 end_date date,
 created_at timestamptz not null default now()
);

create table if not exists public.notification_requests (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 package_id uuid references public.ad_packages(id) on delete set null,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 body text not null check(char_length(btrim(body)) between 1 and 500),
 target_category text,
 send_count integer not null default 1 check(send_count between 1 and 100),
 time_start text,
 time_end text,
 days integer[] not null default '{0,1,2,3,4,5,6}',
 price numeric(12,2) not null default 0 check(price>=0),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 rejection_reason text,
 created_at timestamptz not null default now()
);

create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid references public.user_profiles(id) on delete set null,
 title text not null,
 body text not null,
 target text not null default 'all' check(target in ('all','category','business','user')),
 target_category text,
 type text not null default 'announcement',
 created_at timestamptz not null default now()
);

create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 business_id uuid references public.businesses(id) on delete set null,
 ad_id uuid references public.ads(id) on delete set null,
 amount numeric(12,2) not null default 0,
 status text not null default 'pending' check(status in ('pending','paid','refunded')),
 method text not null default 'manual',
 note text,
 created_at timestamptz not null default now()
);

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 note text,
 items jsonb not null default '[]'::jsonb,
 total numeric(12,2) not null default 0 check(total>=0),
 status text not null default 'pending' check(status in ('pending','approved','rejected','on_the_way','delivered')),
 customer_name text,
 phone text,
 address text,
 lat double precision,
 lng double precision,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 type text not null default 'reservation' check(type in ('reservation','appointment')),
 date date not null,
 time text not null,
 guests integer not null default 1 check(guests between 1 and 50),
 service_id uuid references public.menu_items(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','completed')),
 customer_name text,
 phone text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

-- Geri bildirim sistemi (yorum, öneri, destek, şikâyet, hesap silme)
create table if not exists public.business_reviews (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 rating integer not null check(rating between 1 and 5),
 comment text not null default '',
 topic text,
 status text not null default 'pending' check(status in ('pending','published','hidden','deleted')),
 moderation_reason text,
 reply text,
 reply_status text check(reply_status is null or reply_status in ('pending','published','hidden')),
 reply_reason text,
 reply_updated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(business_id,user_id)
);

create table if not exists public.business_suggestions (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 topic text not null check(topic in ('price','student_discount','variety','service','environment','hours','other')),
 description text not null check(char_length(description) between 5 and 2000),
 status text not null default 'pending' check(status in ('pending','published','hidden','deleted')),
 moderation_reason text,
 reply text,
 reply_status text check(reply_status is null or reply_status in ('pending','published','hidden')),
 reply_reason text,
 reply_updated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.suggestion_supports (
 suggestion_id uuid not null references public.business_suggestions(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(suggestion_id,user_id)
);

create table if not exists public.feedback_rate_limits (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 action text not null,
 created_at timestamptz not null default now()
);

create table if not exists public.complaints (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.user_profiles(id) on delete set null,
 business_id uuid references public.businesses(id) on delete cascade,
 target_type text not null default 'business' check(target_type in ('business','review','suggestion','review_reply','suggestion_reply')),
 target_id uuid,
 feedback_category text check(feedback_category is null or feedback_category in ('price','hygiene','staff','service','waiting','misleading','other','abuse','spam','personal_data')),
 description text,
 evidence_path text,
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 resolution_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.account_deletion_requests (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 status text not null default 'processing' check(status in ('processing','failed','completed')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 error_code text
);

-- ---------------------------------------------------------------------------------------------------------
-- 3) Dizinler
-- ---------------------------------------------------------------------------------------------------------
create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists businesses_owner_idx on public.businesses(owner_id);
create index if not exists businesses_public_idx on public.businesses(approval_status,is_published,created_at desc);
create index if not exists businesses_category_idx on public.businesses(category);
create index if not exists menu_items_business_idx on public.menu_items(business_id,sort_order,created_at);
create index if not exists ads_business_idx on public.ads(business_id,created_at desc);
create index if not exists ads_status_idx on public.ads(status,type);
create index if not exists business_posts_business_idx on public.business_posts(business_id,created_at desc);
create index if not exists business_posts_public_idx on public.business_posts(kind,status,created_at desc);
create index if not exists campaigns_business_idx on public.campaigns(business_id,created_at desc);
create index if not exists notification_requests_business_idx on public.notification_requests(business_id,created_at desc);
create index if not exists payments_business_idx on public.payments(business_id,created_at desc);
create index if not exists payments_note_idx on public.payments(note) where note is not null;
create index if not exists payments_ad_idx on public.payments(ad_id) where ad_id is not null;
create index if not exists orders_user_idx on public.orders(user_id,created_at desc);
create index if not exists orders_business_idx on public.orders(business_id,created_at desc);
create index if not exists reservations_user_idx on public.reservations(user_id,created_at desc);
create index if not exists reservations_business_idx on public.reservations(business_id,created_at desc);
create index if not exists business_reviews_business_idx on public.business_reviews(business_id,status,created_at desc);
create index if not exists business_suggestions_business_idx on public.business_suggestions(business_id,status,created_at desc);
create index if not exists feedback_rate_limits_idx on public.feedback_rate_limits(user_id,action,created_at desc);
create index if not exists complaints_status_idx on public.complaints(status,created_at desc);
create index if not exists complaints_business_idx on public.complaints(business_id,user_id);
create index if not exists admin_logs_created_idx on public.admin_logs(created_at desc);
create index if not exists admin_alerts_unread_idx on public.admin_alerts(is_read,created_at desc);
create index if not exists notifications_created_idx on public.notifications(created_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- 4) Tetikleyici fonksiyonları (kimlik / fiyat / korumalı sütun)
-- ---------------------------------------------------------------------------------------------------------
-- Yeni auth kullanıcısı için profil: hesap türü yalnızca kayıt anında okunur; yönetici yalnızca doğrulanmış sahip e-postasına verilir.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare assigned_role text := 'user';
begin
 if new.raw_user_meta_data->>'role'='business' then assigned_role:='business'; end if;
 if lower(trim(new.email))='caddeden.app@gmail.com' and new.email_confirmed_at is not null then assigned_role:='admin'; end if;
 insert into public.user_profiles(id,username,email,role,phone,first_name,last_name,gender)
 values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),new.email,assigned_role,
 new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'last_name',
 case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' else null end)
 on conflict (id) do nothing;
 return new;
end; $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.protect_user_profile_cols()
returns trigger language plpgsql as $$
declare jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
begin
 if jwt_role in ('authenticated','anon') or current_user in ('authenticated','anon') then
  if new.id is distinct from old.id then raise exception 'Profil kimliği değiştirilemez.' using errcode='42501'; end if;
  if new.role is distinct from old.role then raise exception 'Hesap türünü yalnızca yönetici belirleyebilir.' using errcode='42501'; end if;
  new.email:=old.email; new.status:=old.status; new.restricted_until:=old.restricted_until;
 end if;
 return new;
end; $$;

-- İşletme sahibi onay/yayın/öne çıkarma/puan alanlarını değiştiremez; yönetici service_role (admin-api) ile değiştirir.
create or replace function public.protect_business_cols()
returns trigger language plpgsql as $$
declare jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
 limited boolean:=jwt_role in ('authenticated','anon') or current_user in ('authenticated','anon');
begin
 if not limited then return new; end if;
 if tg_op='INSERT' then
  new.approval_status:='pending'; new.is_published:=false; new.featured:=false; new.rejection_reason:=null;
  new.rating:=0; new.review_count:=0;
 else
  new.owner_id:=old.owner_id; new.approval_status:=old.approval_status; new.is_published:=old.is_published;
  new.featured:=old.featured; new.rejection_reason:=old.rejection_reason; new.rating:=old.rating; new.review_count:=old.review_count;
  new.created_at:=old.created_at;
 end if;
 return new;
end; $$;

-- Reklam başvurusu: fiyat, durum ve ödeme durumu istemciden değil, yönetici tanımlı paketten gelir.
create or replace function public.protect_ad_insert()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare pkg public.ad_packages;
 jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
begin
 if jwt_role in ('service_role') or current_user in ('service_role','postgres','supabase_admin') then return new; end if;
 select * into pkg from public.ad_packages where id=new.package_id and active;
 if pkg.id is null then raise exception 'Seçilen reklam paketi bulunamadı veya satışta değil.' using errcode='22023'; end if;
 if pkg.type not in ('discover_featured','reels_sponsored','posts_sponsored','category_featured','map_featured','home_promo','notification_promo') then
  raise exception 'Bu paket reklam başvurusu için uygun değil.' using errcode='22023';
 end if;
 new.type:=pkg.type; new.price:=pkg.price; new.status:='pending'; new.payment_status:='unpaid';
 new.start_date:=null; new.end_date:=null; new.rejection_reason:=null;
 return new;
end; $$;

-- İçerik (gönderi / Cadde TV): durum ve ödeme yönetici kararıdır; fiyat paketten gelir; sahip sonradan değiştiremez.
create or replace function public.protect_post_write()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare pkg public.ad_packages;
 jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
begin
 if jwt_role in ('service_role') or current_user in ('service_role','postgres','supabase_admin') then return new; end if;
 if tg_op='UPDATE' then
  new.business_id:=old.business_id; new.kind:=old.kind; new.package_id:=old.package_id; new.price:=old.price;
  new.payment_status:=old.payment_status; new.status:=old.status; new.rejection_reason:=old.rejection_reason;
  new.start_date:=old.start_date; new.end_date:=old.end_date; new.image_url:=old.image_url;
  return new;
 end if;
 new.status:='pending'; new.payment_status:='unpaid'; new.rejection_reason:=null; new.start_date:=null; new.end_date:=null;
 if new.package_id is null then
  new.price:=0;
 else
  select * into pkg from public.ad_packages where id=new.package_id and active;
  if pkg.id is null or pkg.type is distinct from (case when new.kind='reel' then 'content_reel' else 'content_post' end) then
   raise exception 'Seçilen içerik paketi bulunamadı veya bu içerik türü için uygun değil.' using errcode='22023';
  end if;
  new.price:=pkg.price;
 end if;
 return new;
end; $$;

-- Bildirim talebi: fiyat paketten, durum yönetici onayından gelir.
create or replace function public.protect_notification_request_insert()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare pkg public.ad_packages;
 jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
begin
 if jwt_role in ('service_role') or current_user in ('service_role','postgres','supabase_admin') then return new; end if;
 new.status:='pending'; new.payment_status:='unpaid'; new.rejection_reason:=null;
 if new.package_id is null then
  new.price:=0;
 else
  select * into pkg from public.ad_packages where id=new.package_id and active;
  if pkg.id is null or pkg.type is distinct from 'business_notification' then
   raise exception 'Seçilen bildirim paketi bulunamadı veya satışta değil.' using errcode='22023';
  end if;
  new.price:=pkg.price;
 end if;
 return new;
end; $$;

-- Yöneticiye yeni başvuru uyarısı (admin_alerts.type: business | ad | content | campaign).
create or replace function public.admin_alert_on_insert()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.admin_alerts(type,ref_id,title,body) values(tg_argv[0],new.id,tg_argv[1],coalesce(tg_argv[2],''));
 return new;
end; $$;
revoke all on function public.admin_alert_on_insert() from public,anon,authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5) Tetikleyiciler
-- ---------------------------------------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop trigger if exists protect_user_profile_cols on public.user_profiles;
create trigger protect_user_profile_cols before update on public.user_profiles for each row execute function public.protect_user_profile_cols();
drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();

drop trigger if exists protect_business_cols on public.businesses;
create trigger protect_business_cols before insert or update on public.businesses for each row execute function public.protect_business_cols();
drop trigger if exists businesses_updated_at on public.businesses;
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();

drop trigger if exists protect_ad_insert on public.ads;
create trigger protect_ad_insert before insert on public.ads for each row execute function public.protect_ad_insert();
drop trigger if exists protect_post_write on public.business_posts;
create trigger protect_post_write before insert or update on public.business_posts for each row execute function public.protect_post_write();
drop trigger if exists protect_notification_request_insert on public.notification_requests;
create trigger protect_notification_request_insert before insert on public.notification_requests for each row execute function public.protect_notification_request_insert();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists reservations_updated_at on public.reservations;
create trigger reservations_updated_at before update on public.reservations for each row execute function public.set_updated_at();
drop trigger if exists business_reviews_updated_at on public.business_reviews;
create trigger business_reviews_updated_at before update on public.business_reviews for each row execute function public.set_updated_at();
drop trigger if exists business_suggestions_updated_at on public.business_suggestions;
create trigger business_suggestions_updated_at before update on public.business_suggestions for each row execute function public.set_updated_at();
drop trigger if exists complaints_updated_at on public.complaints;
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();

drop trigger if exists admin_alert_business on public.businesses;
create trigger admin_alert_business after insert on public.businesses for each row execute function public.admin_alert_on_insert('business','Yeni işletme başvurusu','Yeni bir işletme onay bekliyor.');
drop trigger if exists admin_alert_ad on public.ads;
create trigger admin_alert_ad after insert on public.ads for each row execute function public.admin_alert_on_insert('ad','Yeni reklam başvurusu','Yeni bir reklam onay bekliyor.');
drop trigger if exists admin_alert_content on public.business_posts;
create trigger admin_alert_content after insert on public.business_posts for each row execute function public.admin_alert_on_insert('content','Yeni içerik başvurusu','Yeni bir paylaşım onay bekliyor.');
drop trigger if exists admin_alert_campaign on public.campaigns;
create trigger admin_alert_campaign after insert on public.campaigns for each row execute function public.admin_alert_on_insert('campaign','Yeni kampanya başvurusu','Yeni bir kampanya onay bekliyor.');

-- ---------------------------------------------------------------------------------------------------------
-- 6) Geri bildirim kimlik/yetki yardımcıları (feedback_*)
-- ---------------------------------------------------------------------------------------------------------
-- Tek yetkili yönetici hesabı: doğrulanmış e-posta + admin rolü + etkin durum.
create or replace function public.feedback_admin_allowed() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.role='admin' and p.status='active' and (p.restricted_until is null or p.restricted_until<=now())
 and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null and u.deleted_at is null);
$$;
revoke all on function public.feedback_admin_allowed() from public;
grant execute on function public.feedback_admin_allowed() to anon,authenticated,service_role;

-- Oturum açmış, etkin, e-postası doğrulanmış, silme isteği olmayan hesabın kimliği. p_customer=true: yalnızca müşteri.
create or replace function public.feedback_actor(p_customer boolean) returns uuid
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); p public.user_profiles;
begin
 if u is null then raise exception 'Bu işlem için giriş yapmalısınız.' using errcode='42501'; end if;
 select * into p from public.user_profiles where id=u;
 if p.id is null or p.status<>'active' or (p.restricted_until is not null and p.restricted_until>now()) then
  raise exception 'Hesabınız bu işlem için uygun değil.' using errcode='42501'; end if;
 if not exists(select 1 from auth.users x where x.id=u and x.email_confirmed_at is not null and x.deleted_at is null) then
  raise exception 'E-posta adresinizi doğrulayın.' using errcode='42501'; end if;
 if exists(select 1 from public.account_deletion_requests d where d.user_id=u) then
  raise exception 'Hesap silme işlemi sürüyor.' using errcode='42501'; end if;
 if p_customer and (p.role<>'user' or exists(select 1 from public.businesses where owner_id=u)) then
  raise exception 'Bu işlem yalnızca müşteri hesaplarına açıktır.' using errcode='42501'; end if;
 return u;
end; $$;
revoke all on function public.feedback_actor(boolean) from public,anon,authenticated;
grant execute on function public.feedback_actor(boolean) to service_role;

-- Basit hız sınırı (kullanıcı + işlem başına saatte en fazla N).
create or replace function public.feedback_throttle(p_user uuid,p_action text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare lim integer:=case p_action when 'review' then 10 when 'suggest' then 10 when 'complaint' then 5 when 'support' then 60 else 30 end;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_action,20261001));
 delete from public.feedback_rate_limits where user_id=p_user and action=p_action and created_at<now()-interval '1 day';
 if (select count(*) from public.feedback_rate_limits where user_id=p_user and action=p_action and created_at>now()-interval '1 hour')>=lim then
  raise exception 'Çok fazla işlem yaptınız. Lütfen biraz sonra tekrar deneyin.' using errcode='P0001'; end if;
 insert into public.feedback_rate_limits(user_id,action) values(p_user,p_action);
end; $$;
revoke all on function public.feedback_throttle(uuid,text) from public,anon,authenticated;
grant execute on function public.feedback_throttle(uuid,text) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 7) feedback_ratings / feedback_read / feedback_write / feedback_admin_read
--    NOT: Sonraki migration'lar bu fonksiyonların gövdesini metin değiştirerek yamalar
--    (20261020_account_role_separation, _account_type_decisions, _customers_without_approval,
--    _independent_stars, _feedback_criteria). Aşağıdaki ifade kalıpları bu yüzden birebir korunmalıdır.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.feedback_ratings(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(b.id::text,jsonb_build_object('rating',coalesce(s.rating,0),'count',coalesce(s.total,0))),'{}'::jsonb)
 from public.businesses b
 left join (select r.business_id as id,round(avg(rating),1) as rating,count(*) as total from public.business_reviews r
  where r.status='published' and r.business_id=any(p_ids) group by r.business_id) s on s.id=b.id
 where b.id=any(p_ids) and ((b.approval_status='approved' and b.is_published) or b.owner_id=auth.uid() or public.feedback_admin_allowed());
$$;
revoke all on function public.feedback_ratings(uuid[]) from public;
grant execute on function public.feedback_ratings(uuid[]) to anon,authenticated,service_role;

create or replace function public.feedback_read(p_business_id uuid,p_sort text default 'newest',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); is_owner boolean; is_public boolean; admin boolean;
 reviews jsonb; mine jsonb; suggestions jsonb; complaints jsonb; positive jsonb; reported jsonb; requested jsonb; ratings jsonb;
begin
 admin:=public.feedback_admin_allowed();
 select owner_id=auth.uid(),approval_status='approved' and is_published into is_owner,is_public from public.businesses where id=p_business_id;
 if not found or (not coalesce(is_public,false) and not coalesce(is_owner,false) and not admin) then
  raise exception 'İşletme bulunamadı veya yayında değil.' using errcode='42501'; end if;
 ratings:=coalesce(public.feedback_ratings(array[p_business_id])->p_business_id::text,'{"rating":0,"count":0}'::jsonb);
 select coalesce(jsonb_agg(to_jsonb(x)-'ordinal' order by x.ordinal),'[]'::jsonb) into reviews from (
  select id,rating,comment,topic,created_at,updated_at,case when reply_status='published' then reply end as reply,reply_status,
   (select upper(left(btrim(coalesce(pr.first_name,pr.username,'')),1))||'***' from public.user_profiles pr where pr.id=business_reviews.user_id) as author,
   row_number() over(order by case when p_sort='highest' then rating end desc nulls last,case when p_sort='lowest' then rating end asc nulls last,created_at desc,id) as ordinal
  from public.business_reviews where business_id=p_business_id and status='published'
  order by ordinal offset greatest(0,coalesce(p_offset,0)) limit 10
 ) x;
 select to_jsonb(m) into mine from (
  select id,rating,comment,topic,status,moderation_reason,created_at,updated_at,reply,reply_status,reply_reason
  from public.business_reviews where business_id=p_business_id and user_id=u and status<>'deleted'
 ) m;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]'::jsonb) into suggestions from (
  select g.id,g.topic,g.description,g.status,g.moderation_reason,g.created_at,
   case when g.reply_status='published' then g.reply end as reply,g.reply_status,
   (select count(*) from public.suggestion_supports x where x.suggestion_id=g.id) as supports,
   exists(select 1 from public.suggestion_supports x where x.suggestion_id=g.id and x.user_id=u) as supported
  from public.business_suggestions g
  where g.business_id=p_business_id and (g.status='published' or (g.user_id=u and g.status<>'deleted'))
  order by g.created_at desc limit 50
 ) s;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]'::jsonb) into complaints from (
  select id,feedback_category,status,description,resolution_note,created_at
  from public.complaints where user_id=u and business_id=p_business_id order by created_at desc limit 20
 ) c;
 select to_jsonb(h) into positive from (select topic,count(distinct user_id) as count from public.business_reviews where business_id=p_business_id and status='published' and rating>=4 group by topic having count(distinct user_id)>=3 order by count desc,topic limit 1) h;
 select to_jsonb(h) into reported from (select feedback_category as topic,count(distinct user_id) as count from public.complaints where business_id=p_business_id and target_type='business' and status<>'dismissed' and feedback_category is not null group by feedback_category having count(distinct user_id)>=3 order by count desc,feedback_category limit 1) h;
 select to_jsonb(h) into requested from (select g.topic,count(distinct x.user_id) as count from public.business_suggestions g join public.suggestion_supports x on x.suggestion_id=g.id where g.business_id=p_business_id and g.status='published' group by g.topic having count(distinct x.user_id)>=3 order by count desc,g.topic limit 1) h;
 return jsonb_build_object('owner',coalesce(is_owner,false),'ratings',ratings,'reviews',reviews,'mine',mine,'suggestions',suggestions,
  'complaints',complaints,'positive',positive,'reported',case when coalesce(is_owner,false) or admin then reported end,'requested',requested);
end; $$;
revoke all on function public.feedback_read(uuid,text,integer) from public;
grant execute on function public.feedback_read(uuid,text,integer) to anon,authenticated,service_role;

create or replace function public.feedback_write(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid; b uuid; item uuid; txt text; n integer; st text; kind_name text; target_kind text; target_ref uuid;
begin
 if p_action is null or p_action not in ('review','delete_review','suggest','support','review_reply','suggestion_reply','complaint','moderate','complaint_status') then
  raise exception 'Bilinmeyen işlem.' using errcode='22023'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Geçersiz istek.' using errcode='22023'; end if;
 if p_action in ('moderate','complaint_status') then
  if not public.feedback_admin_allowed() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
  u:=auth.uid();
 else
  u:=public.feedback_actor(p_action not in ('review_reply','suggestion_reply'));
  perform public.feedback_throttle(u,p_action);
 end if;
 if p_action='review' then
 b:=(p_data->>'business_id')::uuid;
 if not exists(select 1 from public.businesses where id=b and approval_status='approved' and is_published) then raise exception 'İşletme yayında değil.'; end if;
 n:=(p_data->>'rating')::integer;
 if n is null or n not between 1 and 5 then raise exception 'Puan 1–5 arasında olmalı.'; end if;
 txt:=trim(coalesce(p_data->>'comment',''));
 if char_length(txt)>2000 then raise exception 'Yorum en fazla 2000 karakter olmalı.'; end if;
 st:=nullif(p_data->>'topic','');
 insert into public.business_reviews(business_id,user_id,rating,comment,topic,status)
 values(b,u,n,txt,st,'pending')
 on conflict(business_id,user_id) do update set rating=excluded.rating,comment=excluded.comment,topic=excluded.topic,
 status=case when business_reviews.status='hidden' then 'hidden' else 'pending' end,updated_at=now();
 elsif p_action='delete_review' then
 item:=(p_data->>'id')::uuid;
 update public.business_reviews set status='deleted',comment='',reply=null,reply_status=null,updated_at=now() where id=item and user_id=u;
 if not found then raise exception 'Değerlendirme bulunamadı.' using errcode='42501'; end if;
 elsif p_action='suggest' then
 b:=(p_data->>'business_id')::uuid;
 if not exists(select 1 from public.businesses where id=b and approval_status='approved' and is_published) then raise exception 'İşletme yayında değil.'; end if;
 st:=p_data->>'topic';
 if st is null or st not in ('price','student_discount','variety','service','environment','hours','other') then raise exception 'Geçersiz öneri konusu.'; end if;
 txt:=trim(coalesce(p_data->>'description',''));
 if char_length(txt) not between 5 and 2000 then raise exception 'Öneri açıklaması 5–2000 karakter olmalı.'; end if;
 insert into public.business_suggestions(business_id,user_id,topic,description,status) values(b,u,st,txt,'pending');
 elsif p_action='support' then
 item:=(p_data->>'id')::uuid;
 select s.business_id into b from public.business_suggestions s where s.id=item and s.status='published';
 if b is null then raise exception 'Öneri bulunamadı.' using errcode='42501'; end if;
 if exists(select 1 from public.businesses x where x.id=b and x.owner_id=u) then raise exception 'Kendi işletmenize gelen öneriyi destekleyemezsiniz.' using errcode='42501'; end if;
 if coalesce((p_data->>'active')::boolean,true) then
  insert into public.suggestion_supports(suggestion_id,user_id) values(item,u) on conflict do nothing;
 else
  delete from public.suggestion_supports where suggestion_id=item and user_id=u;
 end if;
 elsif p_action='review_reply' then
 item:=(p_data->>'id')::uuid;
 txt:=trim(coalesce(p_data->>'text',''));
 if char_length(txt) not between 5 and 1500 then raise exception 'Cevap 5–1500 karakter olmalı.'; end if;
 select r.business_id into b from public.business_reviews r where r.id=item and r.status<>'deleted';
 if b is null or not exists(select 1 from public.businesses where id=b and owner_id=u) then raise exception 'Bu yoruma yalnızca işletme sahibi cevap verebilir.' using errcode='42501'; end if;
 update public.business_reviews set reply=txt,reply_status='pending',reply_reason=null,reply_updated_at=now() where id=item;
 elsif p_action='suggestion_reply' then
 item:=(p_data->>'id')::uuid;
 txt:=trim(coalesce(p_data->>'text',''));
 if char_length(txt) not between 5 and 1500 then raise exception 'Cevap 5–1500 karakter olmalı.'; end if;
 select s.business_id into b from public.business_suggestions s where s.id=item and s.status='published';
 if b is null or not exists(select 1 from public.businesses where id=b and owner_id=u) then raise exception 'Bu öneriye yalnızca işletme sahibi cevap verebilir.' using errcode='42501'; end if;
 update public.business_suggestions set reply=txt,reply_status='pending',reply_reason=null,reply_updated_at=now() where id=item;
 elsif p_action='complaint' then
 target_kind:=coalesce(p_data->>'target_type','business');
 target_ref:=(p_data->>'target_id')::uuid;
 if target_kind not in ('business','review','suggestion','review_reply','suggestion_reply') or target_ref is null then raise exception 'Geçersiz şikâyet hedefi.' using errcode='22023'; end if;
 if target_kind='business' then b:=target_ref;
 elsif target_kind in ('review','review_reply') then select business_id into b from public.business_reviews where id=target_ref;
 else select business_id into b from public.business_suggestions where id=target_ref; end if;
 if b is null or not exists(select 1 from public.businesses where id=b and approval_status='approved' and is_published) then raise exception 'Şikâyet edilen kayıt bulunamadı.' using errcode='22023'; end if;
 st:=p_data->>'category';
 if st is null or st not in ('price','hygiene','staff','service','waiting','misleading','other','abuse','spam','personal_data') then raise exception 'Geçersiz şikâyet konusu.' using errcode='22023'; end if;
 txt:=trim(coalesce(p_data->>'description',''));
 if char_length(txt) not between 10 and 2000 then raise exception 'Şikâyet açıklaması 10–2000 karakter olmalı.' using errcode='22023'; end if;
 if nullif(p_data->>'evidence_path','') is not null and ((p_data->>'evidence_path') not like u::text||'/%' or char_length(p_data->>'evidence_path')>300 or (p_data->>'evidence_path') like '%..%') then
  raise exception 'Geçersiz kanıt dosyası.' using errcode='22023'; end if;
 insert into public.complaints(user_id,business_id,target_type,target_id,feedback_category,description,evidence_path)
 values(u,b,target_kind,target_ref,st,txt,nullif(p_data->>'evidence_path',''));
 elsif p_action='moderate' then
 item:=(p_data->>'id')::uuid; kind_name:=p_data->>'kind'; st:=p_data->>'status'; txt:=trim(coalesce(p_data->>'reason',''));
 if st is null or st not in ('published','hidden') or char_length(txt) not between 5 and 1000 then raise exception 'Durum ve en az 5 karakterlik gerekçe gerekli.' using errcode='22023'; end if;
 if kind_name='review' then
  update public.business_reviews set status=st,moderation_reason=case when st='hidden' then txt else null end where id=item and status<>'deleted';
 elsif kind_name='suggestion' then
  update public.business_suggestions set status=st,moderation_reason=case when st='hidden' then txt else null end where id=item and status<>'deleted';
 elsif kind_name='review_reply' then
  update public.business_reviews set reply_status=st,reply_reason=case when st='hidden' then txt else null end where id=item and reply is not null;
 elsif kind_name='suggestion_reply' then
  update public.business_suggestions set reply_status=st,reply_reason=case when st='hidden' then txt else null end where id=item and reply is not null;
 else raise exception 'Geçersiz içerik türü.' using errcode='22023'; end if;
 if not found then raise exception 'Kayıt bulunamadı.' using errcode='22023'; end if;
 insert into public.admin_logs(admin_id,action,detail) values(u,'feedback_moderate',jsonb_build_object('kind',kind_name,'id',item,'status',st,'reason',txt));
 elsif p_action='complaint_status' then
 item:=(p_data->>'id')::uuid; st:=p_data->>'status'; txt:=trim(coalesce(p_data->>'reason',''));
 if st is null or st not in ('reviewing','resolved','dismissed') or char_length(txt) not between 5 and 1000 then raise exception 'Durum ve en az 5 karakterlik gerekçe gerekli.' using errcode='22023'; end if;
 update public.complaints set status=st,resolution_note=txt where id=item;
 if not found then raise exception 'Şikâyet bulunamadı.' using errcode='22023'; end if;
 insert into public.admin_logs(admin_id,action,detail) values(u,'feedback_complaint_status',jsonb_build_object('id',item,'status',st,'reason',txt));
 else raise exception 'Bilinmeyen işlem.' using errcode='22023';
 end if;
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.feedback_write(text,jsonb) from public,anon;
grant execute on function public.feedback_write(text,jsonb) to authenticated,service_role;

-- Yönetici moderasyon listeleri (kişisel kullanıcı kimlikleri döndürülmez).
create or replace function public.feedback_admin_read(p_kind text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.feedback_admin_allowed() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_kind='review' then
  select coalesce(jsonb_agg((to_jsonb(r)-'user_id')||jsonb_build_object('business_name',b.name) order by (r.reply_status='pending') desc nulls last,r.created_at desc),'[]'::jsonb) into result
  from (select * from public.business_reviews where status<>'deleted' order by created_at desc limit 200) r join public.businesses b on b.id=r.business_id;
 elsif p_kind='suggestion' then
  select coalesce(jsonb_agg((to_jsonb(g)-'user_id')||jsonb_build_object('business_name',b.name,'supports',(select count(*) from public.suggestion_supports x where x.suggestion_id=g.id)) order by g.created_at desc),'[]'::jsonb) into result
  from (select * from public.business_suggestions where status<>'deleted' order by created_at desc limit 200) g join public.businesses b on b.id=g.business_id;
 elsif p_kind='complaint' then
  select coalesce(jsonb_agg((to_jsonb(c)-'user_id')||jsonb_build_object('business_name',b.name) order by c.created_at desc),'[]'::jsonb) into result
  from (select * from public.complaints order by created_at desc limit 200) c left join public.businesses b on b.id=c.business_id;
 elsif p_kind='summary' then
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'business_name',b.name,'status','published','summary',public.feedback_read(b.id,'newest',0)-'reviews') order by b.name),'[]'::jsonb) into result
  from (select * from public.businesses where approval_status='approved' and is_published order by name limit 100) b;
 else raise exception 'Geçersiz liste türü.' using errcode='22023';
 end if;
 return result;
end; $$;
revoke all on function public.feedback_admin_read(text) from public,anon;
grant execute on function public.feedback_admin_read(text) to authenticated,service_role;

-- Hesap silme (feedback-api tarafından service_role ile çağrılır). Sert silme yok: işlem kayıtları korunur, kişisel veri temizlenir.
create or replace function public.feedback_begin_account_deletion(p_user uuid,p_resume boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.account_deletion_requests;
begin
 select * into r from public.account_deletion_requests where user_id=p_user for update;
 if r.user_id is null then
  if coalesce(p_resume,false) then raise exception 'Devam ettirilebilir silme isteği yok.' using errcode='P0002'; end if;
  insert into public.account_deletion_requests(user_id,status) values(p_user,'processing');
 elsif r.status='completed' then raise exception 'Hesap silme zaten tamamlandı.' using errcode='23505';
 elsif r.status='processing' and not coalesce(p_resume,false) then raise exception 'Silme işlemi zaten sürüyor.' using errcode='23505';
 else update public.account_deletion_requests set status='processing',error_code=null where user_id=p_user;
 end if;
end; $$;
revoke all on function public.feedback_begin_account_deletion(uuid,boolean) from public,anon,authenticated;
grant execute on function public.feedback_begin_account_deletion(uuid,boolean) to service_role;

create or replace function public.feedback_delete_account_data(p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_user is null then raise exception 'Geçersiz kullanıcı.' using errcode='22023'; end if;
 update public.user_profiles set username=null,phone=null,first_name=null,last_name=null,gender=null,address=null,lat=null,lng=null,
  school_name=null,education_status=null,email='deleted-'||p_user::text||'@deleted.invalid' where id=p_user and role<>'admin';
 update public.orders set customer_name=null,phone=null,address=null,lat=null,lng=null where user_id=p_user;
 update public.reservations set customer_name=null,phone=null where user_id=p_user;
 delete from public.suggestion_supports where user_id=p_user;
 delete from public.business_suggestions where user_id=p_user;
 delete from public.business_reviews where user_id=p_user;
 delete from public.feedback_rate_limits where user_id=p_user;
 update public.complaints set user_id=null,evidence_path=null where user_id=p_user;
 if to_regclass('public.cafe_visits') is not null then execute 'delete from public.cafe_visits where user_id=$1' using p_user; end if;
 if to_regclass('public.cafe_social_profiles') is not null then execute 'delete from public.cafe_social_profiles where user_id=$1' using p_user; end if;
 if to_regclass('public.cafe_profile_photos') is not null then execute 'delete from public.cafe_profile_photos where user_id=$1' using p_user; end if;
 if to_regclass('public.cafe_instagram_requests') is not null then execute 'delete from public.cafe_instagram_requests where requester_id=$1 or recipient_id=$1' using p_user; end if;
 if to_regclass('public.venue_profile_preferences') is not null then execute 'delete from public.venue_profile_preferences where user_id=$1' using p_user; end if;
 if to_regclass('public.customer_inbox') is not null then execute 'delete from public.customer_inbox where user_id=$1' using p_user; end if;
 if to_regclass('public.customer_inbox_reads') is not null then execute 'delete from public.customer_inbox_reads where user_id=$1' using p_user; end if;
 if to_regclass('public.university_messages') is not null then execute 'delete from public.university_messages where user_id=$1' using p_user; end if;
end; $$;
revoke all on function public.feedback_delete_account_data(uuid) from public,anon,authenticated;
grant execute on function public.feedback_delete_account_data(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 8) Satır düzeyi güvenlik (RLS) ve tablo yetkileri
--    Kalıp: izinli (permissive) temel politikalar burada; sonraki migration'lar RESTRICTIVE politikalarla daraltır.
-- ---------------------------------------------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.app_config enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admin_alerts enable row level security;
alter table public.businesses enable row level security;
alter table public.menu_items enable row level security;
alter table public.ad_packages enable row level security;
alter table public.ads enable row level security;
alter table public.business_posts enable row level security;
alter table public.campaigns enable row level security;
alter table public.notification_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.orders enable row level security;
alter table public.reservations enable row level security;
alter table public.business_reviews enable row level security;
alter table public.business_suggestions enable row level security;
alter table public.suggestion_supports enable row level security;
alter table public.feedback_rate_limits enable row level security;
alter table public.complaints enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Önce her şeyi kapat, sonra yalnızca gerekenleri aç.
revoke all on public.user_profiles,public.app_config,public.admin_logs,public.admin_alerts,public.businesses,public.menu_items,
 public.ad_packages,public.ads,public.business_posts,public.campaigns,public.notification_requests,public.notifications,
 public.payments,public.orders,public.reservations,public.business_reviews,public.business_suggestions,
 public.suggestion_supports,public.feedback_rate_limits,public.complaints,public.account_deletion_requests from anon,authenticated;
grant all on public.user_profiles,public.app_config,public.admin_logs,public.admin_alerts,public.businesses,public.menu_items,
 public.ad_packages,public.ads,public.business_posts,public.campaigns,public.notification_requests,public.notifications,
 public.payments,public.orders,public.reservations,public.business_reviews,public.business_suggestions,
 public.suggestion_supports,public.feedback_rate_limits,public.complaints,public.account_deletion_requests to service_role;

-- user_profiles: yalnızca kendi satırı; rol/durum/e-posta tetikleyiciyle korunur, ayrıca sütun yetkisi dardır.
grant select on public.user_profiles to authenticated;
grant update(username,first_name,last_name,gender,phone,address,lat,lng,school_name,education_status) on public.user_profiles to authenticated;
drop policy if exists base_profiles_select_own on public.user_profiles;
create policy base_profiles_select_own on public.user_profiles for select to authenticated using (id=auth.uid());
drop policy if exists base_profiles_update_own on public.user_profiles;
create policy base_profiles_update_own on public.user_profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- businesses
grant select on public.businesses to anon;
grant select,insert,update,delete on public.businesses to authenticated;
drop policy if exists base_businesses_public_select on public.businesses;
create policy base_businesses_public_select on public.businesses for select to anon,authenticated using (approval_status='approved' and is_published);
drop policy if exists base_businesses_owner_select on public.businesses;
create policy base_businesses_owner_select on public.businesses for select to authenticated using (owner_id=auth.uid());
drop policy if exists base_businesses_owner_insert on public.businesses;
create policy base_businesses_owner_insert on public.businesses for insert to authenticated with check (owner_id=auth.uid());
drop policy if exists base_businesses_owner_update on public.businesses;
create policy base_businesses_owner_update on public.businesses for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists base_businesses_owner_delete on public.businesses;
create policy base_businesses_owner_delete on public.businesses for delete to authenticated using (owner_id=auth.uid());

-- menu_items
grant select on public.menu_items to anon;
grant select,insert,update,delete on public.menu_items to authenticated;
drop policy if exists base_menu_public_select on public.menu_items;
create policy base_menu_public_select on public.menu_items for select to anon,authenticated
 using (exists(select 1 from public.businesses b where b.id=menu_items.business_id and ((b.approval_status='approved' and b.is_published) or b.owner_id=auth.uid())));
drop policy if exists base_menu_owner_insert on public.menu_items;
create policy base_menu_owner_insert on public.menu_items for insert to authenticated
 with check (exists(select 1 from public.businesses b where b.id=menu_items.business_id and b.owner_id=auth.uid()));
drop policy if exists base_menu_owner_update on public.menu_items;
create policy base_menu_owner_update on public.menu_items for update to authenticated
 using (exists(select 1 from public.businesses b where b.id=menu_items.business_id and b.owner_id=auth.uid()))
 with check (exists(select 1 from public.businesses b where b.id=menu_items.business_id and b.owner_id=auth.uid()));
drop policy if exists base_menu_owner_delete on public.menu_items;
create policy base_menu_owner_delete on public.menu_items for delete to authenticated
 using (exists(select 1 from public.businesses b where b.id=menu_items.business_id and b.owner_id=auth.uid()));

-- ad_packages: yalnızca satıştaki paketler okunur; yazma yalnızca yönetici (service_role).
grant select on public.ad_packages to anon,authenticated;
drop policy if exists base_packages_select_active on public.ad_packages;
create policy base_packages_select_active on public.ad_packages for select to anon,authenticated using (active);

-- ads: yalnızca sahibi görür/başvurur; durum/fiyat tetikleyiciyle sunucuda belirlenir.
grant select,insert on public.ads to authenticated;
drop policy if exists base_ads_owner_select on public.ads;
create policy base_ads_owner_select on public.ads for select to authenticated
 using (exists(select 1 from public.businesses b where b.id=ads.business_id and b.owner_id=auth.uid()));
drop policy if exists base_ads_owner_insert on public.ads;
create policy base_ads_owner_insert on public.ads for insert to authenticated
 with check (exists(select 1 from public.businesses b where b.id=ads.business_id and b.owner_id=auth.uid()));

-- business_posts: herkes onaylı içeriği, sahibi kendi içeriğini görür; sahibi ekler/siler (güncelleme yok).
grant select on public.business_posts to anon;
grant select,insert,delete on public.business_posts to authenticated;
drop policy if exists base_posts_public_select on public.business_posts;
create policy base_posts_public_select on public.business_posts for select to anon using (status='approved');
drop policy if exists base_posts_auth_select on public.business_posts;
create policy base_posts_auth_select on public.business_posts for select to authenticated
 using (status='approved' or exists(select 1 from public.businesses b where b.id=business_posts.business_id and b.owner_id=auth.uid()));
drop policy if exists base_posts_owner_insert on public.business_posts;
create policy base_posts_owner_insert on public.business_posts for insert to authenticated
 with check (exists(select 1 from public.businesses b where b.id=business_posts.business_id and b.owner_id=auth.uid()));
drop policy if exists base_posts_owner_delete on public.business_posts;
create policy base_posts_owner_delete on public.business_posts for delete to authenticated
 using (exists(select 1 from public.businesses b where b.id=business_posts.business_id and b.owner_id=auth.uid()));

-- campaigns: başvuru yalnızca submit_paid_campaign() ile (migration); burada okuma ve silme.
grant select on public.campaigns to anon;
grant select,delete on public.campaigns to authenticated;
drop policy if exists base_campaigns_public_select on public.campaigns;
create policy base_campaigns_public_select on public.campaigns for select to anon using (status='approved');
drop policy if exists base_campaigns_auth_select on public.campaigns;
create policy base_campaigns_auth_select on public.campaigns for select to authenticated
 using (status='approved' or exists(select 1 from public.businesses b where b.id=campaigns.business_id and b.owner_id=auth.uid()));
drop policy if exists base_campaigns_owner_delete on public.campaigns;
create policy base_campaigns_owner_delete on public.campaigns for delete to authenticated
 using (exists(select 1 from public.businesses b where b.id=campaigns.business_id and b.owner_id=auth.uid()));

-- notification_requests
grant select,insert,delete on public.notification_requests to authenticated;
drop policy if exists base_notifreq_owner_select on public.notification_requests;
create policy base_notifreq_owner_select on public.notification_requests for select to authenticated
 using (exists(select 1 from public.businesses b where b.id=notification_requests.business_id and b.owner_id=auth.uid()));
drop policy if exists base_notifreq_owner_insert on public.notification_requests;
create policy base_notifreq_owner_insert on public.notification_requests for insert to authenticated
 with check (exists(select 1 from public.businesses b where b.id=notification_requests.business_id and b.owner_id=auth.uid()));
drop policy if exists base_notifreq_owner_delete on public.notification_requests;
create policy base_notifreq_owner_delete on public.notification_requests for delete to authenticated
 using (exists(select 1 from public.businesses b where b.id=notification_requests.business_id and b.owner_id=auth.uid()));

-- payments: işletme sahibi yalnızca kendi kayıtlarını okur; yazma yalnızca service_role / SECURITY DEFINER fonksiyonlar.
grant select on public.payments to authenticated;
drop policy if exists base_payments_owner_select on public.payments;
create policy base_payments_owner_select on public.payments for select to authenticated
 using (exists(select 1 from public.businesses b where b.id=payments.business_id and b.owner_id=auth.uid()));

-- orders / reservations: müşteri kendi kaydını, işletme sahibi kendi işletmesinin kayıtlarını görür; yalnızca sahibi durumu günceller.
grant select,insert on public.orders,public.reservations to authenticated;
grant update(status) on public.orders,public.reservations to authenticated;
drop policy if exists base_orders_select on public.orders;
create policy base_orders_select on public.orders for select to authenticated
 using (user_id=auth.uid() or exists(select 1 from public.businesses b where b.id=orders.business_id and b.owner_id=auth.uid()));
drop policy if exists base_orders_insert on public.orders;
create policy base_orders_insert on public.orders for insert to authenticated with check (user_id=auth.uid());
drop policy if exists base_orders_owner_update on public.orders;
create policy base_orders_owner_update on public.orders for update to authenticated
 using (exists(select 1 from public.businesses b where b.id=orders.business_id and b.owner_id=auth.uid()))
 with check (exists(select 1 from public.businesses b where b.id=orders.business_id and b.owner_id=auth.uid()));
drop policy if exists base_reservations_select on public.reservations;
create policy base_reservations_select on public.reservations for select to authenticated
 using (user_id=auth.uid() or exists(select 1 from public.businesses b where b.id=reservations.business_id and b.owner_id=auth.uid()));
drop policy if exists base_reservations_insert on public.reservations;
create policy base_reservations_insert on public.reservations for insert to authenticated with check (user_id=auth.uid());
drop policy if exists base_reservations_owner_update on public.reservations;
create policy base_reservations_owner_update on public.reservations for update to authenticated
 using (exists(select 1 from public.businesses b where b.id=reservations.business_id and b.owner_id=auth.uid()))
 with check (exists(select 1 from public.businesses b where b.id=reservations.business_id and b.owner_id=auth.uid()));

-- Aşağıdaki tablolar istemciden DOĞRUDAN erişilemez (RLS açık, politika yok, yetki yok): app_config, admin_logs, admin_alerts,
-- notifications, business_reviews, business_suggestions, suggestion_supports, feedback_rate_limits, complaints,
-- account_deletion_requests. Erişim yalnızca SECURITY DEFINER fonksiyonlar ve Edge Function'lar (service_role) üzerinden.

-- ---------------------------------------------------------------------------------------------------------
-- 9) Storage: kovalar ve politikalar
-- ---------------------------------------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('business-media','business-media',true,10485760,array['image/jpeg','image/png','image/webp']),
 ('feedback-evidence','feedback-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- business-media: herkese açık okuma; yükleme/değiştirme/silme yalnızca {business_id}/... yolunun işletme sahibi.
drop policy if exists base_media_public_read on storage.objects;
create policy base_media_public_read on storage.objects for select to anon,authenticated using (bucket_id='business-media');
drop policy if exists base_media_owner_insert on storage.objects;
create policy base_media_owner_insert on storage.objects for insert to authenticated
 with check (bucket_id='business-media' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(objects.name))[1] and b.owner_id=auth.uid()));
drop policy if exists base_media_owner_update on storage.objects;
create policy base_media_owner_update on storage.objects for update to authenticated
 using (bucket_id='business-media' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(objects.name))[1] and b.owner_id=auth.uid()))
 with check (bucket_id='business-media' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(objects.name))[1] and b.owner_id=auth.uid()));
drop policy if exists base_media_owner_delete on storage.objects;
create policy base_media_owner_delete on storage.objects for delete to authenticated
 using (bucket_id='business-media' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(objects.name))[1] and b.owner_id=auth.uid()));

-- feedback-evidence: özel; kullanıcı yalnızca kendi {user_id}/... klasörüne yükler/okur/siler. Yönetici imzalı bağlantıyı feedback-api üretir.
drop policy if exists base_evidence_own_insert on storage.objects;
create policy base_evidence_own_insert on storage.objects for insert to authenticated
 with check (bucket_id='feedback-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists base_evidence_own_select on storage.objects;
create policy base_evidence_own_select on storage.objects for select to authenticated
 using (bucket_id='feedback-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists base_evidence_own_delete on storage.objects;
create policy base_evidence_own_delete on storage.objects for delete to authenticated
 using (bucket_id='feedback-evidence' and (storage.foldername(name))[1]=auth.uid()::text);

notify pgrst,'reload schema';
commit;

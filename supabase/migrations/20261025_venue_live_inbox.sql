-- Live venue presence, public aggregate occupancy, private education and a persistent customer inbox.
-- Additive schema/function changes only; no existing user records are migrated or removed.
begin;
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
commit;
notify pgrst,'reload schema';

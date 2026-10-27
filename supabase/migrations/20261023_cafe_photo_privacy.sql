-- Cafe visit photo privacy: opt-in rooms, short-lived visits and private photo storage.
-- Additive only: existing profiles, account roles and business permissions are unchanged.
begin;
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
commit;
notify pgrst,'reload schema';

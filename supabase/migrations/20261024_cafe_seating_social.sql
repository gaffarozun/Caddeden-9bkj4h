-- Add optional cafe table plans, participant-based estimates and private Instagram consent.
-- Additive schema; no migration changes existing user records or cafe participation choices.
begin;
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
commit;
notify pgrst,'reload schema';

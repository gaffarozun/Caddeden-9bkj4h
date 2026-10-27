-- Venue participation: 40 m entry, seating transport repair, anonymous profiles and seven-day rejection privacy.
-- Schema/functions only; existing records, preferences and request history are not rewritten.
begin;
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
commit;
notify pgrst,'reload schema';

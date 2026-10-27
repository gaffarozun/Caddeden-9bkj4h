-- Venue-page seating is local-only; aggregate occupancy remains visible on the venue page.
-- No customer records, seating plans, photos or existing consent decisions are modified.
begin;
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
commit;
notify pgrst,'reload schema';

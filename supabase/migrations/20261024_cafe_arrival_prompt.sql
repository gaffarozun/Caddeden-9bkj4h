-- Opt-in arrival suggestions and manual entry share a strict distance < 20 m gate.
-- No existing visits, businesses, photos or consent records are modified by this migration.
begin;
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
commit;
notify pgrst,'reload schema';

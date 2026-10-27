-- Mutual Instagram access and handle requirements. Function definitions only; no user records changed.
begin;
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
commit;
notify pgrst,'reload schema';

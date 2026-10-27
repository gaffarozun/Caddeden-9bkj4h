-- Read-only all-category venue privacy and owner opt-in regression.
begin;
do $$
declare signature text; definition text; b record; payload jsonb;
begin
 foreach signature in array array['public.cafe_room_live(uuid)','public.cafe_venue_live(uuid)','public.cafe_set_room(uuid,boolean)','public.cafe_save_seating(uuid,boolean,jsonb)','public.cafe_room_state(uuid)','public.cafe_nearby(double precision,double precision,double precision,timestamptz)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('category' in definition)>0 then raise exception 'Category restriction remains: %',signature; end if;
 end loop;
 if position('account_can_manage' in pg_get_functiondef('public.cafe_set_room(uuid,boolean)'::regprocedure))=0 or position('account_can_manage' in pg_get_functiondef('public.cafe_save_seating(uuid,boolean,jsonb)'::regprocedure))=0 then raise exception 'Owner opt-in protection missing'; end if;
 definition:=pg_get_functiondef('public.cafe_room_state(uuid)'::regprocedure);
 if position('if enabled and local_visit then' in definition)=0 or position('not public.cafe_photo_blocked(auth.uid(),v.user_id)' in definition)=0 then raise exception 'Local profile/cooldown protection missing'; end if;
 definition:=pg_get_functiondef('public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)'::regprocedure);
 if position('d>=40' in definition)=0 or position('p_accuracy between 0 and 20' in definition)=0 then raise exception 'GPS boundary changed'; end if;
 if has_function_privilege('anon','public.cafe_nearby(double precision,double precision,double precision,timestamptz)','execute') or has_table_privilege('authenticated','public.cafe_tables','select') then raise exception 'Private access exposed'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 for b in select x.id,x.approval_status,x.is_published,x.lat,x.lng,coalesce(r.enabled,false) as enabled,coalesce(r.occupancy_enabled,false) as plan_enabled from public.businesses x left join public.cafe_rooms r on r.business_id=x.id loop
  if public.cafe_room_live(b.id) is distinct from (b.enabled and b.approval_status='approved' and b.is_published) then raise exception 'Social opt-in/publication mismatch'; end if;
  if public.cafe_venue_live(b.id) is distinct from ((b.enabled or b.plan_enabled) and b.approval_status='approved' and b.is_published and b.lat is not null and b.lng is not null) then raise exception 'Venue opt-in/publication/location mismatch'; end if;
  payload:=public.cafe_room_state(b.id);
  if payload->'members'<>'[]'::jsonb or payload->'tables'<>'[]'::jsonb then raise exception 'Remote user saw private venue content'; end if;
 end loop;
end; $$;
rollback;

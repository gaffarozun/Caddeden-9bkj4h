-- Read-only venue-page regression; no customer records or plans are modified.
begin;
do $$
declare b record; actor uuid; payload jsonb; mine jsonb; local_visit boolean; manager boolean; definition text;
begin
 if has_function_privilege('anon','public.cafe_venue_live(uuid)','execute') or has_function_privilege('authenticated','public.cafe_venue_live(uuid)','execute') then raise exception 'Internal venue helper exposed'; end if;
 if has_table_privilege('authenticated','public.cafe_tables','select') then raise exception 'Direct seating reads exposed'; end if;
 definition:=pg_get_functiondef('public.cafe_room_state(uuid)'::regprocedure);
 if position('plan_visible:=manager or (show_plan and local_visit)' in definition)=0 then raise exception 'Local-only plan gate missing'; end if;
 if position('if enabled and local_visit then' in definition)=0 or position('not public.cafe_photo_blocked(auth.uid(),v.user_id)' in definition)=0 then raise exception 'Social location/cooldown gate missing'; end if;
 if position('p_visible and public.cafe_room_live(p_business)' in pg_get_functiondef('public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)'::regprocedure))=0 then raise exception 'Seating-only entry must not share photos'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 for b in select id from public.businesses  loop
  payload:=public.cafe_room_state(b.id);
  if payload->'tables'<>'[]'::jsonb or payload->'members'<>'[]'::jsonb or (payload->>'plan_visible')::boolean then raise exception 'Remote/anonymous viewer saw local-only content'; end if;
 end loop;
 select id into actor from public.user_profiles where role='user' and public.cafe_customer_live(id) limit 1;
 if actor is not null then
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  mine:=public.cafe_my_visit();
  for b in select id from public.businesses  loop
   payload:=public.cafe_room_state(b.id); local_visit:=coalesce(mine->>'business_id'=b.id::text,false); manager:=coalesce(public.account_can_manage(b.id),false);
   if not local_visit and not manager and (payload->'tables'<>'[]'::jsonb or payload->'members'<>'[]'::jsonb or (payload->>'plan_visible')::boolean) then raise exception 'Remote customer saw venue-only content'; end if;
   if not (payload->>'enabled')::boolean and payload->'members'<>'[]'::jsonb then raise exception 'Seating-only room exposed profiles'; end if;
   if payload::text like '%instagram_handle%' then raise exception 'Venue overview exposed Instagram addresses'; end if;
  end loop;
 end if;
 if position('interval ''7 days''' in pg_get_functiondef('public.cafe_decide_instagram(uuid,boolean)'::regprocedure))=0 then raise exception 'Seven-day rejection privacy missing'; end if;
end; $$;
rollback;

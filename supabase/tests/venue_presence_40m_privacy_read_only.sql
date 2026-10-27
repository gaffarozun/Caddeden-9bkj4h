-- Read-only deployment regression. No user records or preferences are written.
begin;
do $$
declare b record; actor uuid; payload jsonb; peer jsonb; item jsonb; expected integer;
begin
 if position('v_distance>=50' in pg_get_functiondef('public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)'::regprocedure))=0 or position('x.distance_meters<50' in pg_get_functiondef('public.cafe_nearby(double precision,double precision,double precision,timestamptz)'::regprocedure))=0 then raise exception '50 m entry contract missing'; end if;
 if position('between 0 and 20' in pg_get_functiondef('public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)'::regprocedure))>0 then raise exception 'Obsolete accuracy ceiling'; end if;
 if position('interval ''7 days''' in pg_get_functiondef('public.cafe_decide_instagram(uuid,boolean)'::regprocedure))=0 then raise exception 'Seven-day rejection missing'; end if;
 if position('declare t jsonb' in pg_get_functiondef('public.cafe_save_seating(uuid,boolean,jsonb)'::regprocedure))>0 then raise exception 'Ambiguous seating alias remains'; end if;
 if has_function_privilege('anon','public.cafe_save_seating_payload(uuid,boolean,text)','execute') or has_function_privilege('anon','public.venue_profile_preference()','execute') or has_function_privilege('authenticated','public.venue_profile_enabled(uuid)','execute') or has_table_privilege('authenticated','public.venue_profile_preferences','select') then raise exception 'Private RPC/settings exposed'; end if;
 if not (select relrowsecurity from pg_class where oid='public.venue_profile_preferences'::regclass) then raise exception 'Preference RLS missing'; end if;
 if public.venue_masked_name('Ayşe','Yılmaz')<>'Ayşe Y***' then raise exception 'Surname masking wrong'; end if;
 perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{"role":"anon"}',true);
 for b in select id from public.businesses loop
  payload:=public.cafe_room_state(b.id);
  if payload->'members'<>'[]'::jsonb or payload->'tables'<>'[]'::jsonb  then raise exception 'Remote identity/plan leak'; end if;
 end loop;
 for actor in select id from public.user_profiles where role='user' and public.cafe_customer_live(id) limit 10 loop
  perform set_config('request.jwt.claim.sub',actor::text,true); perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  payload:=public.cafe_social_state();
  select count(distinct recipient_id)::integer into expected from public.cafe_instagram_requests where requester_id=actor;
  if (payload->>'sent_recipient_count')::integer<>expected then raise exception 'Distinct-target own count wrong'; end if;
  for item in select value from jsonb_array_elements(payload->'incoming') loop
   select count(distinct h.recipient_id)::integer into expected from public.cafe_instagram_requests h where h.requester_id=(item->>'user_id')::uuid;
   if (item->>'requester_sent_count')::integer<>expected then raise exception 'Incoming sender count wrong'; end if;
  end loop;
  for b in select id from public.businesses loop
   payload:=public.cafe_room_state(b.id);
   for peer in select value from jsonb_array_elements(payload->'members') loop
    if (peer->>'anonymous')::boolean and (peer->>'name'<>'Kullanıcı' or peer->'photo_path'<>'null'::jsonb or (peer->>'has_instagram')::boolean or peer->'request_id'<>'null'::jsonb) then raise exception 'Anonymous peer identity leak'; end if;
   end loop;
  end loop;
 end loop;
end; $$;
rollback;

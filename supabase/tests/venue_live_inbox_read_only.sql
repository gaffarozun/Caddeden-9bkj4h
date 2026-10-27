-- Read-only regression; no user data, consent or location is modified.
begin;
do $$
declare b record; actor uuid; payload jsonb; peer jsonb; definition text;
begin
 if has_function_privilege('anon','public.customer_inbox_items()','execute') or has_function_privilege('anon','public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz)','execute') or has_table_privilege('authenticated','public.customer_inbox','insert') then raise exception 'Private access exposed'; end if;
 definition:=pg_get_functiondef('public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz)'::regprocedure);
 if position('v_distance>=50' in definition)=0 or position('90 seconds' in definition)=0 then raise exception 'Exit/heartbeat boundary missing'; end if;
 definition:=pg_get_functiondef('public.cafe_revoke_instagram(uuid)'::regprocedure);
 if position('auth.uid() in (requester_id,recipient_id)' in definition)=0 then raise exception 'Mutual withdrawal missing'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='order_open_guard') then raise exception 'Server closed-order guard missing'; end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"anon"}',true);
 for b in select id from public.businesses where approval_status='approved' and is_published and lat is not null and lng is not null loop
  payload:=public.cafe_room_state(b.id);
  if payload->'members'<>'[]'::jsonb or payload->'tables'<>'[]'::jsonb or payload->>'occupancy_visible'<>'true' then raise exception 'Public occupancy/private members contract broken'; end if;
 end loop;
 for actor in select id from public.user_profiles where public.cafe_customer_live(id) loop
  perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  if public.account_customer() then
   perform public.customer_inbox_items();
   for b in select id from public.businesses loop
    payload:=public.cafe_room_state(b.id);
    if (not public.cafe_instagram_ready(actor) or payload->'mine'='null'::jsonb) and payload->'members'<>'[]'::jsonb then raise exception 'Non-local or Instagram-less member leak';end if;
    for peer in select value from jsonb_array_elements(payload->'members') loop
     if peer->>'anonymous'='true' and (peer->>'name'<>'Kullanıcı' or peer->'school_name'<>'null'::jsonb or peer->'photo_path'<>'null'::jsonb) then raise exception 'Anonymous profile leak';end if;
    end loop;
   end loop;
  end if;
 end loop;
end; $$;
rollback;

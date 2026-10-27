-- Read-only regression: never inserts, updates, deletes or uploads customer data.
begin;
do $$
declare actor uuid; payload jsonb;
begin
 if not (select relrowsecurity from pg_class where oid='public.cafe_tables'::regclass) or not (select relrowsecurity from pg_class where oid='public.cafe_social_profiles'::regclass) or not (select relrowsecurity from pg_class where oid='public.cafe_instagram_requests'::regclass) then raise exception 'Cafe RLS missing'; end if;
 if has_table_privilege('anon','public.cafe_social_profiles','select') or has_table_privilege('authenticated','public.cafe_instagram_requests','select') or has_table_privilege('authenticated','public.cafe_tables','insert') then raise exception 'Private reads or direct writes unexpectedly permitted'; end if;
 if has_function_privilege('anon','public.cafe_request_instagram(uuid)','execute') or has_function_privilege('anon','public.cafe_instagram_link(uuid)','execute') or has_function_privilege('authenticated','public.cafe_pair_live(uuid,uuid)','execute') then raise exception 'Helper or anonymous privileges exposed'; end if;
 if position('not public.cafe_photo_blocked(viewer.user_id,target.user_id)' in pg_get_functiondef('public.cafe_photo_allowed(text)'::regprocedure))=0 then raise exception 'Storage download cooldown guard missing'; end if;
 if position('not public.cafe_photo_blocked(auth.uid(),v.user_id)' in pg_get_functiondef('public.cafe_room_state(uuid)'::regprocedure))=0 then raise exception 'Room listing cooldown guard missing'; end if;
 if position('r.requester_id=auth.uid()' in pg_get_functiondef('public.cafe_instagram_link(uuid)'::regprocedure))=0 or position('public.cafe_pair_live' in pg_get_functiondef('public.cafe_instagram_link(uuid)'::regprocedure))=0 or position('r.status=''accepted''' in pg_get_functiondef('public.cafe_instagram_link(uuid)'::regprocedure))=0 then raise exception 'Instagram consent or co-presence guard missing'; end if;
 if position('recipient_id=auth.uid()' in pg_get_functiondef('public.cafe_decide_instagram(uuid,boolean)'::regprocedure))=0 or position('interval ''7 days''' in pg_get_functiondef('public.cafe_decide_instagram(uuid,boolean)'::regprocedure))=0 then raise exception 'Recipient-only seven-day rejection missing'; end if;
 if not exists(select 1 from storage.buckets where id='cafe-profile-photos' and not public) then raise exception 'Photos must remain private'; end if;
 payload:=public.cafe_room_state('00000000-0000-0000-0000-000000000000');
 if payload->'members'<>'[]'::jsonb or payload->'tables'<>'[]'::jsonb or (payload->>'enabled')::boolean then raise exception 'Unknown cafe exposed content'; end if;
 select id into actor from public.user_profiles where role='user' and status='active' and (restricted_until is null or restricted_until<=now()) and not exists(select 1 from public.account_deletion_requests d where d.user_id=user_profiles.id) limit 1;
 if actor is not null then
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 payload:=public.cafe_social_state();
 if jsonb_typeof(payload->'incoming')<>'array' or jsonb_typeof(payload->'outgoing')<>'array' then raise exception 'Social result is not bounded arrays'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'incoming') i join public.cafe_instagram_requests r on r.id=(i->>'id')::uuid where r.recipient_id<>actor) then raise exception 'Foreign inbox exposed'; end if;
 if payload::text like '%instagram_handle%' then raise exception 'Inbox must not include Instagram handles'; end if;
 begin perform public.cafe_instagram_link('00000000-0000-0000-0000-000000000000'); raise exception 'Unknown consent opened'; exception when insufficient_privilege then null; end;
 end if;
end; $$;
rollback;

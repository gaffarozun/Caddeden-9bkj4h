-- Read-only mutual Instagram contract regression, with no consent or presence writes.
begin;
do $$
declare definition text; r record; actor uuid; target_handle text; url text; actor_item jsonb; payload jsonb;
begin
 definition:=pg_get_functiondef('public.cafe_request_instagram(uuid)'::regprocedure);
 if position('if not public.cafe_instagram_ready(auth.uid())' in definition)=0 or position('if not public.cafe_instagram_ready(p_target)' in definition)=0 then raise exception 'Sender/recipient handle guard missing'; end if;
 definition:=pg_get_functiondef('public.cafe_decide_instagram(uuid,boolean)'::regprocedure);
 if position('not public.cafe_instagram_ready(r.requester_id)' in definition)=0 or position('not public.cafe_instagram_ready(r.recipient_id)' in definition)=0 or position('not public.cafe_instagram_ready(r.requester_id)' in definition)>position('if p_accept and r.status=''accepted''' in definition) then raise exception 'Acceptance must require both handles before success'; end if;
 definition:=pg_get_functiondef('public.cafe_instagram_accessible(uuid)'::regprocedure);
 if position('auth.uid() in (r.requester_id,r.recipient_id)' in definition)=0 or position('r.status=''accepted''' in definition)=0 or position('cafe_pair_live' in definition)=0 or position('target.photo_visible' in definition)=0 or position('cafe_photo_blocked' in definition)=0 then raise exception 'Mutual access/privacy guard missing'; end if;
 if has_function_privilege('anon','public.cafe_instagram_link(uuid)','execute') or has_function_privilege('authenticated','public.cafe_instagram_ready(uuid)','execute') or has_function_privilege('authenticated','public.cafe_instagram_accessible(uuid)','execute') then raise exception 'Private helpers exposed'; end if;
 perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{"role":"anon"}',true);
 if public.cafe_instagram_ready(null) then raise exception 'Missing user can be treated as Instagram-ready'; end if;
 for r in select id,requester_id,recipient_id from public.cafe_instagram_requests where status='accepted' limit 50 loop
  foreach actor in array array[r.requester_id,r.recipient_id] loop
   perform set_config('request.jwt.claim.sub',actor::text,true); perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
   if public.cafe_instagram_accessible(r.id) then
    select instagram_handle into target_handle from public.cafe_social_profiles where user_id=case when actor=r.requester_id then r.recipient_id else r.requester_id end;
    url:=public.cafe_instagram_link(r.id);
    if url is distinct from 'https://www.instagram.com/'||target_handle||'/' then raise exception 'Wrong counterpart link'; end if;
   else
    begin perform public.cafe_instagram_link(r.id); raise exception 'Ineligible link unexpectedly opened'; exception when insufficient_privilege then null; end;
   end if;
  end loop;
 end loop;
 for actor in select id from public.user_profiles where role='user' and public.cafe_customer_live(id) limit 20 loop
  perform set_config('request.jwt.claim.sub',actor::text,true); perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  payload:=public.cafe_social_state();
  for actor_item in select value from jsonb_array_elements(payload->'incoming') loop
   if (actor_item->>'can_open')::boolean is distinct from public.cafe_instagram_accessible((actor_item->>'id')::uuid) then raise exception 'Incoming open flag mismatched'; end if;
  end loop;
 end loop;
end; $$;
rollback;

-- Read-only privacy regression checks. Never inserts, updates or deletes user data.
begin;
do $$
begin
 if not (select relrowsecurity from pg_class where oid='public.cafe_visits'::regclass) then raise exception 'Visit RLS missing'; end if;
 if not (select relrowsecurity from pg_class where oid='public.cafe_profile_photos'::regclass) then raise exception 'Photo RLS missing'; end if;
 if not exists(select 1 from storage.buckets where id='cafe-profile-photos' and not public and file_size_limit=1048576) then raise exception 'Private photo bucket missing'; end if;
 if has_table_privilege('anon','public.cafe_profile_photos','select') or has_table_privilege('authenticated','public.cafe_visits','insert') then raise exception 'Direct private access unexpectedly permitted'; end if;
 if has_function_privilege('anon','public.cafe_set_visibility(boolean)','execute') then raise exception 'Anonymous visibility changes permitted'; end if;
 if position('target.photo_visible' in pg_get_functiondef('public.cafe_photo_allowed(text)'::regprocedure))=0 then raise exception 'Consent check missing'; end if;
 if position('viewer.business_id=target.business_id' in pg_get_functiondef('public.cafe_photo_allowed(text)'::regprocedure))=0 then raise exception 'Same cafe check missing'; end if;
 if position('viewer.expires_at>now()' in pg_get_functiondef('public.cafe_photo_allowed(text)'::regprocedure))=0 then raise exception 'Viewer expiry check missing'; end if;
 if position('target.expires_at>now()' in pg_get_functiondef('public.cafe_photo_allowed(text)'::regprocedure))=0 then raise exception 'Target expiry check missing'; end if;
 if position('if p_visible is null' in pg_get_functiondef('public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)'::regprocedure))=0 then raise exception 'Explicit visibility choice missing'; end if;
end; $$;
rollback;

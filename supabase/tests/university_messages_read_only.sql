-- Read-only university message regression. No fixtures or existing user records are inserted, updated or deleted.
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.university_messages'::regclass) then raise exception 'University RLS missing'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.university_messages'::regclass and conname='university_messages_user_id_fkey' and confrelid='public.user_profiles'::regclass) then raise exception 'Author relationship missing'; end if;
 if has_table_privilege('anon','public.university_messages','select') then raise exception 'Anonymous private read exposed'; end if;
 if has_table_privilege('authenticated','public.university_messages','insert,update,delete') then raise exception 'Direct client mutation exposed'; end if;
 if has_function_privilege('anon','public.submit_university_message(text)','execute') then raise exception 'Anonymous submission exposed'; end if;
 if not has_function_privilege('authenticated','public.submit_university_message(text)','execute') then raise exception 'Customer submission unavailable'; end if;
 if has_function_privilege('authenticated','public.moderate_university_message(uuid,uuid,text,text,text)','execute') then raise exception 'Client moderation exposed'; end if;
 if not has_function_privilege('service_role','public.moderate_university_message(uuid,uuid,text,text,text)','execute') then raise exception 'Admin service moderation unavailable'; end if;
 if not has_function_privilege('anon','public.university_public_messages()','execute') then raise exception 'Public projection unavailable'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='university_messages' and cmd<>'SELECT') then raise exception 'Unexpected client write policy'; end if;
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null) then raise exception 'Existing administrator unavailable'; end if;
end; $$;
begin;
set local role anon;
select count(*) from public.university_public_messages();
reset role;
rollback;

-- Exercise noncustomer guards only; every tested call is denied before the insertion branch.
begin;
select set_config('caddeden.university_noncustomers',coalesce((select jsonb_agg(id::text)::text from public.user_profiles where role in ('business','admin')),'[]'),true);
set local role authenticated;
do $$ declare actor text; denied boolean; begin
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 denied:=false;
 begin perform public.submit_university_message('Yetkisiz kontrol'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Missing session was not blocked'; end if;
 for actor in select jsonb_array_elements_text(current_setting('caddeden.university_noncustomers')::jsonb) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  denied:=false;
  begin perform public.submit_university_message('Yetkisiz kontrol'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Noncustomer submission was not blocked'; end if;
 end loop;
end; $$;
reset role;
rollback;
select 'passed: university permissions, public projection, administrator preservation and noncustomer submission guards' as result;

-- Read-only withdrawal regression. Never creates, withdraws or edits real messages.
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.university_messages'::regclass) then raise exception 'RLS missing'; end if;
 if has_table_privilege('authenticated','public.university_messages','insert,update,delete') then raise exception 'Direct client writes exposed'; end if;
 if has_function_privilege('anon','public.withdraw_university_message(uuid)','execute') then raise exception 'Anonymous withdrawal exposed'; end if;
 if not has_function_privilege('authenticated','public.withdraw_university_message(uuid)','execute') then raise exception 'Authenticated withdrawal unavailable'; end if;
 if has_function_privilege('authenticated','public.moderate_university_message(uuid,uuid,text,text,text)','execute') then raise exception 'Client moderation exposed'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.university_messages'::regclass and tgname='university_withdrawal_guard' and tgenabled<>'D') then raise exception 'Withdrawal guard missing'; end if;
 if exists(select 1 from public.university_public_messages() c join public.university_messages m on m.id=c.id where m.withdrawn_at is not null or m.status<>'approved') then raise exception 'Removed or unapproved message exposed'; end if;
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null) then raise exception 'Existing administrator unavailable'; end if;
end; $$;
begin;
select set_config('caddeden.withdrawal_test',coalesce((select jsonb_build_object('actor',p.id,'message',m.id)::text from public.user_profiles p cross join public.university_messages m where p.role='user' and p.id<>m.user_id limit 1),'{}'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$ declare test jsonb:=current_setting('caddeden.withdrawal_test')::jsonb; denied boolean:=false; begin
 begin perform public.withdraw_university_message('00000000-0000-0000-0000-000000000000'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Sessionless withdrawal not blocked'; end if;
 if test ? 'actor' then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',test->>'actor','role','authenticated')::text,true);
  denied:=false;
  begin perform public.withdraw_university_message((test->>'message')::uuid); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Other author withdrawal was not blocked'; end if;
 end if;
end; $$;
reset role;
rollback;
select 'passed: withdrawal privileges, projection, administrator preservation and denied ownership/session checks' as result;

-- Read-only campaign regression checks; no fixtures, payment or account mutations.
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.campaigns'::regclass) then raise exception 'Campaign RLS missing'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaigns' and column_name='publication_days') then raise exception 'Publication snapshot missing'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.campaigns'::regclass and tgname='zzz_campaign_pricing_guard') then raise exception 'Campaign price guard missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='anon_select_paid_campaigns' and permissive='RESTRICTIVE') then raise exception 'Anonymous paid gate missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='authenticated_select_paid_campaigns' and permissive='RESTRICTIVE') then raise exception 'Authenticated paid gate missing'; end if;
 if has_function_privilege('authenticated','public.admin_campaign_decision(uuid,uuid,text,text,text,text,text)','execute') or has_function_privilege('anon','public.admin_campaign_decision(uuid,uuid,text,text,text,text,text)','execute') then raise exception 'Client moderation exposed'; end if;
 if not has_function_privilege('service_role','public.admin_campaign_decision(uuid,uuid,text,text,text,text,text)','execute') then raise exception 'Admin decision unavailable'; end if;
 if has_function_privilege('anon','public.submit_paid_campaign(uuid,uuid,text,text,text,numeric,integer)','execute') then raise exception 'Anonymous submission exposed'; end if;
 if not has_function_privilege('authenticated','public.submit_paid_campaign(uuid,uuid,text,text,text,numeric,integer)','execute') then raise exception 'Business submission unavailable'; end if;
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com') then raise exception 'Existing administrator unavailable'; end if;
 if exists(select 1 from public.public_paid_campaigns() v join public.campaigns c on c.id=v.id where c.status<>'approved' or c.payment_status<>'paid' or c.price<=0 or c.start_date>current_date or c.end_date<current_date) then raise exception 'Invalid campaign exposed'; end if;
end; $$;
begin;
set local role anon;
select count(*) as visible_paid_campaigns from public.public_paid_campaigns();
reset role;
rollback;
begin;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform public.submit_paid_campaign('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','Kontrol yazısı','','',1,1); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Missing session submission allowed'; end if;
end; $$;
reset role;
rollback;
do $$ declare denied boolean:=false; begin
 begin perform public.admin_campaign_decision('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','status','approved'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unauthorized moderation allowed'; end if;
end; $$;
select 'passed: RLS, paid-only projection, immutable pricing, client/admin permissions, missing-session denial and preserved administrator' as result;

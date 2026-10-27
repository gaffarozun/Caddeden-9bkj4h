-- Read-only helper/RLS tests using existing accounts; no inserts, updates or deletes.
-- Does not constitute real JWT, device, signup or successful business-operation tests.
begin;
select set_config('caddeden.test_actors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'role',p.role,'active',p.status='active' and (p.restricted_until is null or p.restricted_until<=now()) and u.email_confirmed_at is not null and u.deleted_at is null and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)))::text from public.user_profiles p join auth.users u on u.id=p.id),'[]'),true);
set local role authenticated;
do $$ declare actor jsonb; uid uuid; expected boolean; begin
 for actor in select value from jsonb_array_elements(current_setting('caddeden.test_actors')::jsonb) loop
  uid:=(actor->>'id')::uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','user_metadata',jsonb_build_object('role','business'))::text,true);
  if public.account_role() is distinct from actor->>'role' then raise exception 'Client metadata overrode stored role'; end if;
  expected:=(actor->>'role'='user') and (actor->>'active')::boolean;
  if public.account_customer() is distinct from expected then raise exception 'Customer helper mismatch'; end if;
  if actor->>'role'='user' and exists(select 1 from public.businesses where public.account_can_manage(id)) then raise exception 'Customer can manage business'; end if;
  if exists(select 1 from public.orders where user_id<>uid and not public.account_can_manage(business_id)) then raise exception 'Private order leak'; end if;
  if exists(select 1 from public.reservations where user_id<>uid and not public.account_can_manage(business_id)) then raise exception 'Private reservation leak'; end if;
 end loop;
 if has_function_privilege('authenticated','public.admin_set_account_type(uuid,uuid,text,text)','execute') then raise exception 'Client can assign roles'; end if;
end; $$;
reset role;
rollback;
select 'Read-only account helper and RLS checks passed' as result;

-- Public rating eligibility regression, run against the same existing accounts.
begin;
select set_config('caddeden.test_actors',coalesce((select jsonb_agg(id)::text from public.user_profiles),'[]'),true);
set local role authenticated;
do $$ declare actor jsonb; uid uuid; b record; state jsonb; expected boolean; begin
 for actor in select value from jsonb_array_elements(current_setting('caddeden.test_actors')::jsonb) loop
  uid:=trim(both '"' from actor::text)::uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  for b in select id,owner_id from public.businesses where approval_status='approved' and is_published loop
   state:=public.business_star_state(b.id);
   expected:=public.account_customer() and (b.owner_id is distinct from uid);
   if (state->>'canRate')::boolean is distinct from expected then raise exception 'Rating eligibility differs from stored account authorization'; end if;
  end loop;
 end loop;
end; $$;
reset role;
rollback;
select 'Read-only rating eligibility regression passed' as result;

-- Read-only regression: customer access does not require account-type approval.
-- Existing accounts only; no user data or role writes. Real JWT/device flows are separate tests.
begin;
select set_config('caddeden.customer_tests',coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'role',p.role,'eligible',p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
))::text from public.user_profiles p join auth.users u on u.id=p.id),'[]'),true);
set local role authenticated;
do $$ declare actor jsonb; uid uuid; b record; expected boolean; state jsonb; begin
 for actor in select value from jsonb_array_elements(current_setting('caddeden.customer_tests')::jsonb) loop
  uid:=(actor->>'id')::uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  expected:=actor->>'role'='user' and (actor->>'eligible')::boolean;
  if public.account_customer() is distinct from expected then raise exception 'Customer authorization still requires a decision'; end if;
  if actor->>'role'='user' and public.account_business_access() then raise exception 'Customer received business access'; end if;
  if actor->>'role'='business'
   and not exists(select 1 from public.business_account_approvals where user_id=uid and status='approved')
   and public.account_business_access() then raise exception 'Pending business received access'; end if;
  for b in select id,owner_id from public.businesses where approval_status='approved' and is_published loop
   state:=public.business_star_state(b.id);
   if (state->>'canRate')::boolean is distinct from (public.account_customer() and b.owner_id is distinct from uid) then raise exception 'Star eligibility mismatch'; end if;
  end loop;
  if exists(select 1 from public.orders where user_id<>uid and not public.account_can_manage(business_id)) then raise exception 'Private order leak'; end if;
  if exists(select 1 from public.reservations where user_id<>uid and not public.account_can_manage(business_id)) then raise exception 'Private reservation leak'; end if;
 end loop;
 if has_function_privilege('authenticated','public.admin_set_business_account_approval(uuid,uuid,text)','execute') then raise exception 'Client approval rights exposed'; end if;
 if has_function_privilege('authenticated','public.admin_set_account_type(uuid,uuid,text,text)','execute') then raise exception 'Client role writes exposed'; end if;
end; $$;
reset role;
rollback;
select 'Customer/no-approval, business approval, rating and RLS regression passed' as result;

-- Read-only approval policy and existing account regression.
-- This does not create accounts or write approval decisions.
-- Business pending/approved branches require real business fixtures to exercise.
begin;
select set_config('caddeden.approval_test_actors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'role',p.role,'status',p.status,'active',p.status='active' and (p.restricted_until is null or p.restricted_until<=now()) and u.email_confirmed_at is not null and u.deleted_at is null and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)))::text from public.user_profiles p join auth.users u on u.id=p.id),'[]'),true);
set local role authenticated;
do $$ declare actor jsonb; uid uuid; state jsonb; begin
 if has_function_privilege('authenticated','public.admin_set_business_account_approval(uuid,uuid,text)','execute') then raise exception 'Client approval RPC is exposed'; end if;
 if has_table_privilege('authenticated','public.business_account_approvals','insert') or has_table_privilege('authenticated','public.business_account_approvals','update') or has_table_privilege('authenticated','public.business_account_approvals','delete') then raise exception 'Client approval writes are allowed'; end if;
 for actor in select value from jsonb_array_elements(current_setting('caddeden.approval_test_actors')::jsonb) loop
  uid:=(actor->>'id')::uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','user_metadata',jsonb_build_object('business_approval','approved'))::text,true);
  if exists(select 1 from public.business_account_approvals where user_id<>uid) then raise exception 'Another account decision is visible'; end if;
  if actor->>'role'<>'business' then
   if public.account_active() is distinct from (actor->>'active')::boolean then raise exception 'Non-business account access regression'; end if;
   if public.business_account_state() is not null then raise exception 'Customer account received business state'; end if;
  else
   state:=public.business_account_state();
   if not exists(select 1 from public.business_account_approvals where user_id=uid and status='approved') and public.account_business_access() then raise exception 'Pending business access allowed'; end if;
   if (state->>'canManage')::boolean is distinct from public.account_business_access() then raise exception 'Business approval state mismatch'; end if;
  end if;
 end loop;
end; $$;
reset role;
rollback;
select 'Read-only approval permissions and existing account regression passed; live signup/approval not tested' as result;

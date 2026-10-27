-- Customers no longer require an administrator's account-type decision.
-- Changes authorization functions only; roles, ownership, approvals, RLS and records are preserved.
begin;
create or replace function public.account_customer() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and coalesce(public.account_role()='user',false);
$$;
do $migration$
declare definition text; target record;
begin
 for target in select * from (values
 ('public.feedback_actor(boolean)', 'p.role<>''user'' or public.account_type_pending(u)', 'p.role<>''user'''),
 ('public.business_star_state(uuid)', 'and not public.account_type_pending(p.id) and public.account_active()', 'and public.account_active()'),
 ('public.submit_business_star(uuid,uuid,numeric)', 'or public.account_type_pending(p_user)', '')
 ) as targets(signature,old_fragment,new_fragment) loop
  select pg_get_functiondef(target.signature::regprocedure) into definition;
  if strpos(definition,target.old_fragment)>0 then
   execute replace(definition,target.old_fragment,target.new_fragment);
  elsif strpos(definition,'account_type_pending')>0 then
   raise exception 'Unexpected customer decision guard in %; migration cancelled',target.signature;
  end if;
 end loop;
end; $migration$;
notify pgrst,'reload schema';
commit;

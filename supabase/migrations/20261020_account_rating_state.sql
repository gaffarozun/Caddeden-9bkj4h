-- Align rating eligibility with explicit admin account decisions while denying self-rating.
do $$ declare definition text; begin
 select pg_get_functiondef('public.business_star_state(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'and not exists(select 1 from public.businesses b where b.owner_id=p.id)',
 'and not public.account_type_pending(p.id) and public.account_active() and not exists(select 1 from public.businesses b where b.id=p_business_id and b.owner_id=p.id)');
 execute definition;
end; $$;
notify pgrst,'reload schema';

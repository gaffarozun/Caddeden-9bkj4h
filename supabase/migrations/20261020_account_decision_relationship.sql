-- Disambiguate account decision embedding from the deciding-admin FK.
-- Computed relationship chooses user_id, exposes at most one decision and respects RLS.
create or replace function public.account_type_decisions(p_profile public.user_profiles)
returns setof public.account_type_decisions rows 1 language sql stable set search_path=public,pg_temp as $$
 select * from public.account_type_decisions where user_id=(p_profile).id;
$$;
revoke all on function public.account_type_decisions(public.user_profiles) from public,anon,authenticated;
grant execute on function public.account_type_decisions(public.user_profiles) to service_role;
notify pgrst,'reload schema';

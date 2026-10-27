-- Serialize live heartbeats against manual leave/join; function-only migration.
-- Lock the caller's existing visit before renewing, so a concurrent exit cannot be resurrected.
begin;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz)'::regprocedure);
 definition:=replace(definition,'if not exists(select 1 from public.cafe_visits v where v.user_id=auth.uid() and v.business_id=p_business and v.expires_at>now()) then return null; end if;',
 'perform 1 from public.cafe_visits v where v.user_id=auth.uid() and v.business_id=p_business and v.expires_at>clock_timestamp() for update; if not found then return null; end if;');
 execute definition;
end; $$;
commit;
notify pgrst,'reload schema';

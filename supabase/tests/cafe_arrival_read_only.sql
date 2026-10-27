-- Read-only opt-in arrival checks; no presence entries or customer data are written.
begin;
do $$
declare nearby_def text; join_def text;
begin
 nearby_def:=pg_get_functiondef('public.cafe_nearby(double precision,double precision,double precision,timestamptz)'::regprocedure);
 join_def:=pg_get_functiondef('public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)'::regprocedure);
 if has_function_privilege('anon','public.cafe_nearby(double precision,double precision,double precision,timestamptz)','execute') then raise exception 'Anonymous cafe scan exposed'; end if;
 if not has_function_privilege('authenticated','public.cafe_nearby(double precision,double precision,double precision,timestamptz)','execute') then raise exception 'Authenticated suggestion access missing'; end if;
 if position('x.distance_meters<50' in nearby_def)=0 or position('v_distance>=50' in join_def)=0 then raise exception 'Strict 50 metre boundary missing'; end if;
 if position('between 0 and 20' in nearby_def||join_def)>0 then raise exception 'Obsolete accuracy ceiling'; end if;
 if position('account_customer()' in nearby_def)=0 or position('interval ''60 seconds''' in nearby_def)=0 then raise exception 'Account/freshness guard missing'; end if;
 if position('insert into' in lower(nearby_def))>0 or position('update public.' in lower(nearby_def))>0 then raise exception 'Suggestions must be read only'; end if;
 if position('p_visible and public.venue_profile_enabled' in join_def)=0 then raise exception 'Seating-only photo guard missing'; end if;
 if has_table_privilege('authenticated','public.cafe_visits','insert') then raise exception 'Direct participation insert exposed'; end if;
end; $$;
rollback;

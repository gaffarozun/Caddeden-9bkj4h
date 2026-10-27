-- Caddeden per-feature reviews: read-only checks, no user data modifications.
do $$
declare scores jsonb:='{"price":5,"hygiene":4,"staff":3,"service":5,"environment":4,"variety":3}'::jsonb;
 b uuid; payload jsonb; src text;
begin
 if not public.feedback_criteria_valid(scores) then raise exception 'Valid six-feature scores rejected'; end if;
 if public.feedback_review_score(scores,1)<>4.0 then raise exception 'Wrong six-feature average'; end if;
 if public.feedback_review_score('{"price":5,"hygiene":5,"staff":4,"service":4,"environment":4,"variety":3}',1)<>4.2 then raise exception 'Wrong decimal average'; end if;
 if public.feedback_review_score('{}',3)<>3 then raise exception 'Legacy score regression'; end if;
 if public.feedback_criteria_valid(scores-'price')
 or public.feedback_criteria_valid(jsonb_set(scores,'{price}','0'))
 or public.feedback_criteria_valid(jsonb_set(scores,'{price}','6'))
 or public.feedback_criteria_valid(jsonb_set(scores,'{price}','2.5'))
 or public.feedback_criteria_valid(jsonb_set(scores,'{price}','"5"'))
 or public.feedback_criteria_valid(scores||'{"unknown":3}')
 or public.feedback_criteria_valid('[]') or public.feedback_criteria_valid('null')
 or public.feedback_criteria_valid(null) then raise exception 'Invalid criteria accepted'; end if;
 if has_function_privilege('anon','public.feedback_write(text,jsonb)','execute')
 or has_table_privilege('authenticated','public.business_reviews','insert') then raise exception 'Write permission regression'; end if;
 select pg_get_functiondef(oid) into src from pg_proc where pronamespace='public'::regnamespace and proname='feedback_write';
 if strpos(src,'p_data->''criteria_ratings'',''published''')=0
 or strpos(src,'reply_status=case when reply_status=''hidden'' then ''pending'' else ''published'' end')=0
 or strpos(src,'feedback_actor')=0 or strpos(src,'feedback_throttle')=0
 or strpos(src,'owner_id=u')=0 or strpos(src,'feedback_admin_allowed')=0 then raise exception 'Publication/authorization contract regression'; end if;
 -- Private complaint checks below require a connection without an end-user JWT.
 if auth.uid() is null then
  begin perform public.feedback_write('review','{}'); raise exception 'Anonymous review allowed'; exception when insufficient_privilege then null; end;
  begin perform public.feedback_write('review_reply','{}'); raise exception 'Anonymous reply allowed'; exception when insufficient_privilege then null; end;
  select id into b from public.businesses where approval_status='approved' and is_published limit 1;
  if b is not null then
   payload:=public.feedback_read(b,'newest',0);
   perform public.feedback_read(b,'highest',0); perform public.feedback_read(b,'lowest',0);
   if jsonb_typeof(payload->'reviews')<>'array' or jsonb_path_exists(payload->'reviews','$[*].user_id')
   or jsonb_array_length(payload->'complaints')<>0 then raise exception 'Public privacy regression'; end if;
  end if;
 end if;
end;
$$;

-- Record counts are informational; never reset user records to match a fixture.
select json_build_object(
 'profiles',(select count(*) from public.user_profiles),
 'businesses',(select count(*) from public.businesses),
 'reviews',(select count(*) from public.business_reviews),
 'rls_enabled',(select relrowsecurity from pg_class where oid='public.business_reviews'::regclass),
 'criteria_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='business_reviews' and column_name='criteria_ratings')
) as preservation_snapshot;

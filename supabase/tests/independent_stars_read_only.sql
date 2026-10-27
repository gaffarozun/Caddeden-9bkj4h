-- Read-only checks for independent half-star ratings; never submits real votes or toggles the feature.
select json_build_object(
 'feature_enabled',public.experiences_enabled(),
 'ratings_rls',(select relrowsecurity from pg_class where oid='public.business_star_ratings'::regclass),
 'customer_insert',has_table_privilege('authenticated','public.business_star_ratings','insert'),
 'customer_update',has_table_privilege('authenticated','public.business_star_ratings','update'),
 'customer_service_rpc',has_function_privilege('authenticated','public.submit_business_star(uuid,uuid,numeric)','execute'),
 'customer_approval_rpc',has_function_privilege('authenticated','public.set_experience_feature(uuid,boolean)','execute'),
 'duplicate_pairs',(select count(*) from(select business_id,user_id from public.business_star_ratings group by business_id,user_id having count(*)>1) d)
) as catalog_checks;
with sample(rating) as(values(3.5::numeric),(4.0),(5.0))
select round(avg(rating),1)=4.2 as mean_correct,
 bool_and(rating between 0.5 and 5 and rating*2=trunc(rating*2)) as valid_half_stars,
 not(3.25*2=trunc(3.25*2)) as invalid_quarter_rejected from sample;
-- Invalid/missing actors cannot reach any persistent insert/update.
do $$ begin
 begin
  perform public.submit_business_star(null,null,3.25);
  raise exception 'test failure: invalid quarter-star was accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.submit_business_star(null,null,0.5);
  raise exception 'test failure: missing customer was accepted';
 exception when insufficient_privilege then null;
 end;
 if not public.experiences_enabled() then
  begin
   perform public.feedback_write('review','{}'::jsonb);
   raise exception 'test failure: closed feature gate was bypassed';
  exception when insufficient_privilege then
   if sqlerrm<>'Müşteri deneyimleri yönetici onayı bekliyor.' then raise; end if;
  end;
 end if;
end; $$;
begin;
set local role anon;
select public.experiences_enabled() as feature_enabled,
 public.business_star_state((select id from public.businesses where approval_status='approved' and is_published order by id limit 1)) as anonymous_state;
commit;
begin;
set local role authenticated;
do $$ begin
 begin
  perform public.submit_business_star(null,null,4.5);
  raise exception 'test failure: authenticated obtained service-only write access';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.set_experience_feature(null,true);
  raise exception 'test failure: authenticated obtained feature approval access';
 exception when insufficient_privilege then null;
 end;
end; $$;
commit;
-- Successful JWT/Edge writes, updates, averaging multiple real votes, admin approval and UI regression
-- require controlled test accounts; they have NOT been executed by this read-only suite.

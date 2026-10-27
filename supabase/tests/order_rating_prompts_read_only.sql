-- Read-only regressions. No deliveries, receipts, votes or accounts are created or changed.
select
 (select relrowsecurity from pg_class where oid='public.order_rating_receipts'::regclass) as receipts_rls_enabled,
 not has_table_privilege('anon','public.order_rating_receipts','select') as anonymous_receipts_denied,
 not has_table_privilege('authenticated','public.order_rating_receipts','insert') as direct_receipt_spoofing_denied,
 not has_table_privilege('authenticated','public.order_rating_receipts','update') as direct_receipt_rewriting_denied,
 not has_function_privilege('anon','public.pending_order_ratings(timestamptz)','execute') as anonymous_prompts_denied,
 has_function_privilege('authenticated','public.pending_order_ratings(timestamptz)','execute') as authenticated_lookup_available,
 not has_function_privilege('authenticated','public.submit_order_business_rating(uuid,uuid,numeric)','execute') as client_actor_spoofing_denied,
 has_function_privilege('service_role','public.submit_order_business_rating(uuid,uuid,numeric)','execute') as verified_server_submission_available;

select policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename='order_rating_receipts';

select
 position('d.delivered_at<least(p_opened_before,now())' in pg_get_functiondef('public.pending_order_ratings(timestamptz)'::regprocedure))>0 as fixed_opening_cutoff_present,
 position('o.user_id=auth.uid()' in pg_get_functiondef('public.pending_order_ratings(timestamptz)'::regprocedure))>0 as prompt_ownership_present,
 position('o.status=''delivered''' in pg_get_functiondef('public.pending_order_ratings(timestamptz)'::regprocedure))>0 as delivered_only,
 position('perform public.submit_business_star' in pg_get_functiondef('public.submit_order_business_rating(uuid,uuid,numeric)'::regprocedure))>0 as independent_star_guard_reused,
 position('pg_advisory_xact_lock' in pg_get_functiondef('public.submit_order_business_rating(uuid,uuid,numeric)'::regprocedure))>0 as concurrent_submissions_serialized;

do $$ begin
 begin
  perform public.pending_order_ratings(now());
  raise exception 'Unauthenticated prompt lookup unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end; $$;

-- Read-only checks: no records are inserted, updated or deleted.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('order_messages','media_cleanup_queue');
select position('on_the_way' in pg_get_functiondef('public.account_request_guard()'::regprocedure))>0 as dispatch_allowed;
select pg_get_functiondef('public.order_delivery_transition_guard()'::regprocedure) as delivery_guard;
select tgname from pg_trigger where tgrelid='public.orders'::regclass and not tgisinternal;
select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename in ('order_messages','media_cleanup_queue') or (schemaname='public' and policyname like '%live_post_media%');
select has_table_privilege('anon','public.order_messages','select') as anon_cannot_read_expected_false,
 has_table_privilege('authenticated','public.order_messages','insert') as clients_cannot_insert_expected_false,
 has_column_privilege('authenticated','public.order_messages','read_at','update') as can_acknowledge_expected_true,
 has_column_privilege('authenticated','public.order_messages','status','update') as cannot_rewrite_status_expected_false;
select has_function_privilege('anon','public.creative_is_referenced(text)','execute') as reference_check_is_private_expected_false;
select public.public_complaint_email() as configured_public_complaint_address;

-- Read-only checks: reporting must never widen order-table permissions.
select
 not has_function_privilege('anon','public.business_order_report(date,date,uuid,text,text,text,integer)','execute') as anonymous_denied,
 has_function_privilege('authenticated','public.business_order_report(date,date,uuid,text,text,text,integer)','execute') as business_entry_available,
 not has_function_privilege('authenticated','public.admin_order_report(uuid,date,date,uuid,text,text,text,integer)','execute') as admin_actor_spoofing_denied,
 not has_function_privilege('authenticated','public.order_report_data(uuid,date,date,uuid,text,text,text,integer)','execute') as raw_scope_denied,
 has_function_privilege('service_role','public.admin_order_report(uuid,date,date,uuid,text,text,text,integer)','execute') as server_admin_entry_available,
 (select relrowsecurity from pg_class where oid='public.orders'::regclass) as orders_rls_preserved;
-- Summaries are over the full scope, not the 30-row page. No data is created/updated/deleted.
with report as (select public.order_report_data(null,null,null,null,'all','newest','orders',0) as value)
select (value->'summary'->>'orderCount')::bigint=(select count(*) from public.orders) as full_order_count,
 (value->'summary'->>'revenue')::numeric=(select coalesce(sum(total),0) from public.orders where status='delivered') as delivered_only_revenue,
 jsonb_array_length(value->'orders')<=30 as page_bounded,
 (value->>'pageSize')::integer=30 as stable_page_size from report;
-- Daily totals reconcile with the same full scope.
with daily as (select public.order_report_data(null,null,null,null,'all','newest','daily',0) as value)
select (value->>'totalRows')::bigint=(select count(distinct (created_at at time zone 'Europe/Istanbul')::date) from public.orders) as istanbul_day_count,
 jsonb_array_length(value->'days')<=30 as daily_page_bounded from daily;
-- Empty owner scope cannot return other businesses' details, options or totals.
with report as (select public.order_report_data('00000000-0000-0000-0000-000000000000',null,null,null,'all','newest','orders',0) as value)
select value->'orders'='[]'::jsonb and value->'businesses'='[]'::jsonb and (value->'summary'->>'revenue')::numeric=0 as empty_owner_isolated from report;

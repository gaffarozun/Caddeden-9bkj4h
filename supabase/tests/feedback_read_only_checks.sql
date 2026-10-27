-- Caddeden feedback acceptance checks: read-only, no production accounts are modified.
-- Execute against the existing project database. These checks do not replace real JWT/device tests.

select json_build_object(
  'all_new_tables_have_rls', (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.business_reviews'::regclass, 'public.business_suggestions'::regclass,
    'public.suggestion_supports'::regclass, 'public.feedback_rate_limits'::regclass,
    'public.account_deletion_requests'::regclass)),
  'anon_cannot_write', not has_function_privilege('anon', 'public.feedback_write(text,jsonb)', 'execute'),
  'client_cannot_cleanup_accounts', not has_function_privilege('authenticated', 'public.feedback_delete_account_data(uuid)', 'execute'),
  'client_cannot_start_account_cleanup', not has_function_privilege('authenticated', 'public.feedback_begin_account_deletion(uuid,boolean)', 'execute'),
  'client_cannot_insert_reviews', not has_table_privilege('authenticated', 'public.business_reviews', 'insert'),
  'evidence_is_private', (select not public from storage.buckets where id='feedback-evidence')
) as access_contract;

select conrelid::regclass as table_name, pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid in ('public.business_reviews'::regclass, 'public.business_suggestions'::regclass, 'public.suggestion_supports'::regclass)
  and contype in ('p', 'u', 'c');

-- Only run these negative read-helper tests in a connection with no end-user auth.uid().
do $$
begin
  if auth.uid() is not null then raise exception 'Use a connection without an end-user JWT for these checks'; end if;
  begin
    perform public.feedback_actor(true);
    raise exception 'FAIL: unauthenticated actor accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.feedback_admin_read('review');
    raise exception 'FAIL: unauthenticated admin accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.feedback_read('00000000-0000-0000-0000-000000000000', 'newest', 0);
    raise exception 'FAIL: inaccessible business accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

with ratings(user_no, stars) as (values (1,5), (2,3), (3,4)),
     supports(user_no) as (values (1), (1), (2), (3))
select json_build_object(
  'average_equals_four', (select avg(stars)=4 from ratings),
  'review_count_equals_three', (select count(*)=3 from ratings),
  'supporters_are_distinct', (select count(distinct user_no)=3 from supports),
  'two_is_below_minimum_threshold', 2<3
) as calculation_fixtures;

with example as (
  select id from public.businesses where approval_status='approved' and is_published limit 1
), projected as (
  select public.feedback_read(id,'newest',0) as payload from example
)
select json_build_object(
  'published_example_available', exists(select 1 from example),
  'public_read_succeeded', exists(select 1 from projected),
  'reviews_are_array', (select jsonb_typeof(payload->'reviews')='array' from projected),
  'anonymous_complaints_are_empty', (select jsonb_array_length(payload->'complaints')=0 from projected),
  'no_author_ids_in_public_reviews', (select not jsonb_path_exists(payload->'reviews','$[*].user_id') from projected)
) as public_projection;

-- Compare these values with a separately recorded pre-deployment snapshot; do not reset them.
select json_build_object(
  'profiles', (select count(*) from public.user_profiles),
  'businesses', (select count(*) from public.businesses),
  'complaints', (select count(*) from public.complaints),
  'admins', (select count(*) from public.user_profiles where role='admin'),
  'reviews', (select count(*) from public.business_reviews),
  'suggestions', (select count(*) from public.business_suggestions),
  'deletion_requests', (select count(*) from public.account_deletion_requests)
) as preservation_snapshot;

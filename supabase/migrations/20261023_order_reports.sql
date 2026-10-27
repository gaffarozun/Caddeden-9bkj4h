-- Private paginated order histories and complete Istanbul-day revenue aggregates.
-- Existing orders, status guards, account permissions and payment ledgers are unchanged.
begin;
create index if not exists orders_business_created_report_idx on public.orders(business_id,created_at desc,id);
create index if not exists orders_created_report_idx on public.orders(created_at desc,id);

-- Internal projection: only trusted wrappers may choose the ownership scope.
create or replace function public.order_report_data(
 p_owner uuid, p_start date, p_end date, p_business uuid, p_status text,
 p_sort text, p_view text, p_page integer
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_status is null or p_status not in ('all','pending','approved','on_the_way','delivered','rejected')
 or p_sort is null or p_sort not in ('newest','oldest','highest','lowest')
 or p_view is null or p_view not in ('orders','daily')
 or p_page is null or p_page < 0 or p_page > 1000000
 or (p_start is not null and p_end is not null and p_start > p_end) then
  raise exception 'Geçersiz sipariş raporu filtresi.' using errcode='22023';
 end if;
 with scoped as materialized (
  select o.*,b.name as business_name from public.orders o join public.businesses b on b.id=o.business_id
  where (p_owner is null or b.owner_id=p_owner)
   and (p_business is null or o.business_id=p_business)
   and (p_start is null or o.created_at >= (p_start::timestamp at time zone 'Europe/Istanbul'))
   and (p_end is null or o.created_at < ((p_end+1)::timestamp at time zone 'Europe/Istanbul'))
   and (p_status='all' or o.status=p_status)
 ), daily as (
  select (created_at at time zone 'Europe/Istanbul')::date as day,
   count(*) as order_count, count(*) filter(where status='delivered') as delivered_count,
   coalesce(sum(total) filter(where status='delivered'),0) as revenue
  from scoped group by 1
 ), order_page as (
  select s.*,row_number() over(order by
   case when p_sort='newest' then created_at end desc,
   case when p_sort='oldest' then created_at end asc,
   case when p_sort='highest' then total end desc,
   case when p_sort='lowest' then total end asc,created_at desc,id) as ordinal
  from scoped s where p_view='orders'
  order by ordinal limit 30 offset (p_page::bigint*30)
 ), day_page as (
  select d.*,row_number() over(order by
   case when p_sort='newest' then day end desc,
   case when p_sort='oldest' then day end asc,
   case when p_sort='highest' then revenue end desc,
   case when p_sort='lowest' then revenue end asc,day desc) as ordinal
  from daily d where p_view='daily'
  order by ordinal limit 30 offset (p_page::bigint*30)
 )
 select jsonb_build_object(
  'orders',coalesce((select jsonb_agg((to_jsonb(o)-'business_name'-'ordinal') || jsonb_build_object('businesses',jsonb_build_object('name',o.business_name)) order by ordinal) from order_page o),'[]'::jsonb),
  'days',coalesce((select jsonb_agg(to_jsonb(d)-'ordinal' order by ordinal) from day_page d),'[]'::jsonb),
  'totalRows',case when p_view='daily' then (select count(*) from daily) else (select count(*) from scoped) end,
  'page',p_page,'pageSize',30,
  'summary',(select jsonb_build_object('orderCount',count(*),'deliveredCount',count(*) filter(where status='delivered'),
   'revenue',coalesce(sum(total) filter(where status='delivered'),0),
   'average',coalesce(round(avg(total) filter(where status='delivered'),2),0)) from scoped),
  'businesses',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name,b.id) from public.businesses b where p_owner is null or b.owner_id=p_owner),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.order_report_data(uuid,date,date,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.order_report_data(uuid,date,date,uuid,text,text,text,integer) to service_role;

-- Businesses can only report on their own orders, after account approval.
create or replace function public.business_order_report(
 p_start date default null,p_end date default null,p_business uuid default null,
 p_status text default 'all',p_sort text default 'newest',p_view text default 'orders',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not coalesce(public.account_active(),false) or public.account_role() is distinct from 'business' then
  raise exception 'Onaylı işletme hesabı gereklidir.' using errcode='42501';
 end if;
 return public.order_report_data(auth.uid(),p_start,p_end,p_business,p_status,p_sort,p_view,p_page);
end; $$;
revoke all on function public.business_order_report(date,date,uuid,text,text,text,integer) from public,anon;
grant execute on function public.business_order_report(date,date,uuid,text,text,text,integer) to authenticated;

-- Admin access goes through the existing JWT-verified admin-api; never a client-supplied actor.
create or replace function public.admin_order_report(
 p_admin uuid,p_start date default null,p_end date default null,p_business uuid default null,
 p_status text default 'all',p_sort text default 'newest',p_view text default 'orders',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.user_profiles p where p.id=p_admin and p.role='admin' and p.status='active'
  and lower(btrim(p.email))='caddeden.app@gmail.com'
  and (p.restricted_until is null or p.restricted_until<=now())
  and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gereklidir.' using errcode='42501';
 end if;
 return public.order_report_data(null,p_start,p_end,p_business,p_status,p_sort,p_view,p_page);
end; $$;
revoke all on function public.admin_order_report(uuid,date,date,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_order_report(uuid,date,date,uuid,text,text,text,integer) to service_role;
commit;
notify pgrst,'reload schema';

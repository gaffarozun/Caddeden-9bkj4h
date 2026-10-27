-- Public product/service name lookup for Discovery; no existing user data or policies are changed.
begin;
create or replace function public.discovery_search_text(p_text text)
returns text language sql immutable parallel safe set search_path=public,pg_temp as $$
 select lower(translate(btrim(coalesce(p_text,'')), 'ÇĞİÖŞÜçğıöşü', 'CGIOSUcgiosu'));
$$;
revoke all on function public.discovery_search_text(text) from public;
grant execute on function public.discovery_search_text(text) to anon,authenticated,service_role;

create or replace function public.public_menu_search(p_query text, p_main text default 'yeme_icme', p_sub text default 'all', p_open_ids uuid[] default null, p_offset integer default 0, p_limit integer default 40)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with input as (
  select public.discovery_search_text(left(coalesce(p_query,''),200)) as query,
   greatest(0,coalesce(p_offset,0)) as skip, least(40,greatest(1,coalesce(p_limit,40))) as size
 ), published as (
  select b.id,b.name,
   case b.category when 'bar' then 'eglence' when 'club' then 'eglence' when 'berber' then 'erkek_kuafor'
    when 'guzellik_salonu' then 'guzellik' when 'protez_tirnak' then 'guzellik' when 'cilt_bakimi' then 'guzellik'
    when 'kas_kirpik' then 'guzellik' when 'makyaj' then 'guzellik' when 'agda_epilasyon' then 'guzellik' else b.category end as category
  from public.businesses b
  where b.approval_status='approved' and b.is_published and b.allow_menu
   and (p_open_ids is null or b.id=any(p_open_ids))
 ), matches as materialized (
  select m.id as item_id,m.business_id,b.name as business_name,b.category,m.name,m.price,m.description,m.image_url,m.group_name,m.duration_min
  from public.menu_items m join published b on b.id=m.business_id cross join input i
  where i.query<>'' and m.price>=0
   and (p_sub='all' or b.category=p_sub)
   and ((p_main='yeme_icme' and b.category in ('restoran','kafe','market','eglence'))
     or (p_main='guzellik_bakim' and b.category in ('kadin_kuafor','erkek_kuafor','guzellik')))
   and not exists (
    select 1 from regexp_split_to_table(i.query,'[[:space:]]+') as token
    where token<>'' and strpos(public.discovery_search_text(m.name),token)=0
   )
 ), page as materialized (
  select * from matches order by price asc,item_id asc
  offset (select skip from input) limit (select size from input)
 ), stats as (
  select public.business_star_stats(coalesce(array_agg(distinct business_id),array[]::uuid[])) as votes from page
 )
 select jsonb_build_object('total',(select count(*) from matches),'items',coalesce((
  select jsonb_agg(to_jsonb(p)||jsonb_build_object(
   'rating',coalesce(s.votes->p.business_id::text->'rating','0'::jsonb),
   'rating_count',coalesce(s.votes->p.business_id::text->'count','0'::jsonb)
  ) order by p.price asc,p.item_id asc) from page p cross join stats s
 ),'[]'::jsonb));
$$;
comment on function public.public_menu_search(text,text,text,uuid[],integer,integer) is 'Public, paginated menu/product/service search ordered by actual price ascending; only published approved businesses with visible menus and aggregate star votes are exposed.';
revoke all on function public.public_menu_search(text,text,text,uuid[],integer,integer) from public;
grant execute on function public.public_menu_search(text,text,text,uuid[],integer,integer) to anon,authenticated,service_role;
create index if not exists menu_items_business_price_search_idx on public.menu_items(business_id,price,id);
notify pgrst,'reload schema';
commit;

-- Cadde TV: safe public projection of existing approved media.
-- Existing records, RLS, prices, accounts and legacy identifiers are preserved.
create or replace function public.public_cadde_tv_channels()
returns table(id uuid,business_id uuid,business_name text,category text,image_url text,caption text,sponsored boolean,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select channel.id,channel.business_id,b.name,b.category,channel.image_url,channel.caption,channel.sponsored,channel.created_at
 from (
  select p.id,p.business_id,p.image_url,coalesce(p.caption,'') as caption,false as sponsored,p.created_at
  from public.business_posts p
  where p.kind='reel' and p.status='approved' and nullif(btrim(p.image_url),'') is not null
   and (p.start_date is null or p.start_date<=current_date) and (p.end_date is null or p.end_date>=current_date)
  union all
  select a.id,a.business_id,a.image_url,coalesce(a.title,''),true,a.created_at
  from public.ads a
  where a.type='reels_sponsored' and a.status='active' and a.payment_status='paid'
   and nullif(btrim(a.image_url),'') is not null
   and a.start_date<=current_date and a.end_date>=current_date
 ) channel join public.businesses b on b.id=channel.business_id
 where b.approval_status='approved' and b.is_published
 order by channel.sponsored desc,channel.created_at desc,channel.id limit 120;
$$;
revoke all on function public.public_cadde_tv_channels() from public;
grant execute on function public.public_cadde_tv_channels() to anon,authenticated,service_role;
comment on function public.public_cadde_tv_channels() is 'Cadde TV public media only; no owner, contact, payment details or pending content.';
notify pgrst,'reload schema';

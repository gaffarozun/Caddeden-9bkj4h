-- Additive order delivery messages, complaint target and creative cleanup queue.
-- No existing user records are updated/deleted and no historical messages are backfilled.
begin;
create table if not exists public.order_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 business_name text not null, status text not null,
 created_at timestamptz not null default now(), read_at timestamptz
);
alter table public.order_messages enable row level security;
create index if not exists order_messages_unread_idx on public.order_messages(user_id,created_at) where read_at is null;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_messages' and policyname='authenticated_select_own_order_messages') then
  create policy authenticated_select_own_order_messages on public.order_messages for select to authenticated using(user_id=auth.uid());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_messages' and policyname='authenticated_update_own_order_messages') then
  create policy authenticated_update_own_order_messages on public.order_messages for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 end if;
end; $$;
revoke all on public.order_messages from anon,authenticated;
grant select,update(read_at) on public.order_messages to authenticated;
grant all on public.order_messages to service_role;
create or replace function public.order_message_guard() returns trigger language plpgsql as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='authenticated' then
  if (to_jsonb(new)-'read_at') is distinct from (to_jsonb(old)-'read_at') then raise exception 'Yalnızca mesaj okundu bilgisi değiştirilebilir.' using errcode='42501'; end if;
  new.read_at:=now();
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.order_messages'::regclass and tgname='order_message_guard') then
  create trigger order_message_guard before update on public.order_messages for each row execute function public.order_message_guard();
 end if;
end; $$;
-- Change only the allowed status list in the existing comprehensive identity/price guard.
do $$ declare definition text; begin
 select pg_get_functiondef('public.account_request_guard()'::regprocedure) into definition;
 definition:=replace(definition,'''pending'',''approved'',''rejected'',''delivered''','''pending'',''approved'',''rejected'',''on_the_way'',''delivered''');
 execute definition;
end; $$;
create or replace function public.order_delivery_transition_guard() returns trigger language plpgsql as $$
begin
 if new.status is not distinct from old.status then return new; end if;
 if not ((old.status='pending' and new.status in ('approved','rejected'))
 or (old.status='rejected' and new.status='approved')
 or (old.status='approved' and new.status in ('on_the_way','rejected'))
 or (old.status='on_the_way' and new.status='delivered')) then
  raise exception 'Sipariş durumu değişmiş veya geçiş uygun değil. Önce onaylayın, sonra yola çıktı ve teslim edildi adımlarını izleyin.' using errcode='22023';
 end if;
 return new;
end; $$;
create or replace function public.publish_order_message() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  insert into public.order_messages(user_id,order_id,business_name,status)
  values(new.user_id,new.id,coalesce((select name from public.businesses where id=new.business_id),'İşletme'),new.status);
 end if;
 return new;
end; $$;
revoke all on function public.publish_order_message() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='order_delivery_transition_guard') then
  create trigger order_delivery_transition_guard before update on public.orders for each row execute function public.order_delivery_transition_guard();
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='publish_order_message') then
  create trigger publish_order_message after insert or update on public.orders for each row execute function public.publish_order_message();
 end if;
end; $$;
alter table public.business_posts add column if not exists media_removed_at timestamptz;
alter table public.ads add column if not exists media_removed_at timestamptz;
alter table public.campaigns add column if not exists media_removed_at timestamptz;
create table if not exists public.media_cleanup_queue (
 id uuid primary key default gen_random_uuid(),path text not null unique,
 business_id uuid references public.businesses(id) on delete set null,
 created_at timestamptz not null default now(),completed_at timestamptz,
 attempts integer not null default 0,last_error text
);
alter table public.media_cleanup_queue enable row level security;
-- System maintenance data has no public/customer access; service-role only.
revoke all on public.media_cleanup_queue from anon,authenticated;
grant all on public.media_cleanup_queue to service_role;
create or replace function public.public_complaint_email() returns text language sql stable security definer set search_path=public,pg_temp as $$
 select value from public.app_config where key='complaint_email' and value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
$$;
revoke all on function public.public_complaint_email() from public;
grant execute on function public.public_complaint_email() to anon,authenticated,service_role;
-- Enforce expiry even on raw table reads; managers retain moderation access.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_posts' and policyname='anon_select_live_post_media') then
  create policy anon_select_live_post_media on public.business_posts as restrictive for select to anon
   using(nullif(btrim(image_url),'') is not null and (start_date is null or start_date<=(now() at time zone 'Europe/Istanbul')::date) and (end_date is null or end_date>=(now() at time zone 'Europe/Istanbul')::date));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_posts' and policyname='authenticated_select_live_post_media') then
  create policy authenticated_select_live_post_media on public.business_posts as restrictive for select to authenticated
   using(public.account_can_manage(business_id) or (nullif(btrim(image_url),'') is not null and (start_date is null or start_date<=(now() at time zone 'Europe/Istanbul')::date) and (end_date is null or end_date>=(now() at time zone 'Europe/Istanbul')::date)));
 end if;
end; $$;
-- Check references across all businesses, not only the original upload owner.
create or replace function public.creative_is_referenced(p_url text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.business_posts where image_url=p_url)
 or exists(select 1 from public.ads where image_url=p_url)
 or exists(select 1 from public.campaigns where image_url=p_url)
 or exists(select 1 from public.menu_items where image_url=p_url)
 or exists(select 1 from public.businesses b where b.logo_url=p_url or b.cover_url=p_url or b.menu_cover_url=p_url
  or b.images @> jsonb_build_array(p_url)
  or exists(select 1 from jsonb_each_text(case when jsonb_typeof(b.menu_group_covers)='object' then b.menu_group_covers else '{}'::jsonb end) cover where cover.value=p_url));
$$;
revoke all on function public.creative_is_referenced(text) from public,anon,authenticated;
grant execute on function public.creative_is_referenced(text) to service_role;
commit;
notify pgrst,'reload schema';
-- No server cron is installed: this Cloud database cannot enable pg_cron.
-- Physical expiry cleanup runs via media-maintenance on active app startup/foreground/60s polling.

-- Next-open business rating prompts: private receipts, delivered-event lookup and atomic star submission.
-- Existing orders, rating aggregates, delivery guards and account permissions remain unchanged.
begin;
create table if not exists public.order_rating_receipts (
 order_id uuid primary key references public.orders(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 rating numeric(2,1) not null check(rating between 0.5 and 5 and rating*2=trunc(rating*2)),
 rated_at timestamptz not null default now()
);
alter table public.order_rating_receipts enable row level security;
revoke all on public.order_rating_receipts from anon,authenticated;
grant select on public.order_rating_receipts to authenticated;
grant all on public.order_rating_receipts to service_role;
comment on table public.order_rating_receipts is 'Private per-order completion receipts; stars still use one vote per customer/business.';
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='order_rating_receipts' and policyname='authenticated_select_own_order_rating_receipts') then
 -- Customers may only read their own completion receipts; no direct client writes.
 create policy authenticated_select_own_order_rating_receipts on public.order_rating_receipts for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
create index if not exists order_messages_delivered_rating_idx on public.order_messages(user_id,created_at desc,order_id) where status='delivered';
create or replace function public.pending_order_ratings(p_opened_before timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(public.account_customer(),false) then raise exception 'Aktif müşteri hesabı gereklidir.' using errcode='42501'; end if;
 if p_opened_before is null then raise exception 'Uygulama açılış zamanı gereklidir.' using errcode='22023'; end if;
 with delivered as (
 select m.order_id,max(m.created_at) as delivered_at from public.order_messages m
 where m.user_id=auth.uid() and m.status='delivered'
 group by m.order_id
 ), eligible as (
 select o.id as order_id,o.business_id,b.name as business_name,d.delivered_at,r.rating as mine
 from delivered d join public.orders o on o.id=d.order_id
 join public.businesses b on b.id=o.business_id
 left join public.business_star_ratings r on r.business_id=o.business_id and r.user_id=auth.uid()
 where o.user_id=auth.uid() and o.status='delivered'
 and d.delivered_at<least(p_opened_before,now())
 and b.approval_status='approved' and b.is_published and b.owner_id is distinct from auth.uid()
 and not exists(select 1 from public.order_rating_receipts receipt where receipt.order_id=o.id)
 -- A business rating already submitted after this delivery needs no second reminder.
 and (r.updated_at is null or r.updated_at<d.delivered_at)
 order by d.delivered_at desc,o.id limit 10
 )
 select coalesce(jsonb_agg(to_jsonb(e) order by e.delivered_at desc,e.order_id),'[]'::jsonb) into result from eligible e;
 return result;
end; $$;
revoke all on function public.pending_order_ratings(timestamptz) from public,anon;
grant execute on function public.pending_order_ratings(timestamptz) to authenticated;
-- Only rating-api may supply the customer ID, after verifying the JWT and email.
create or replace function public.submit_order_business_rating(p_user uuid,p_order uuid,p_rating numeric) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_business uuid; delivery_at timestamptz;
begin
 if p_rating is null or p_rating not between 0.5 and 5 or p_rating*2<>trunc(p_rating*2) then raise exception '0,5–5 arasında yarım yıldız puanı seçin.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,20261020));
 if not exists(select 1 from public.user_profiles p where p.id=p_user and p.role='user' and p.status='active' and (p.restricted_until is null or p.restricted_until<=now()))
 or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'Aktif müşteri hesabı gereklidir.' using errcode='42501'; end if;
 select o.business_id into target_business from public.orders o where o.id=p_order and o.user_id=p_user and o.status='delivered' for share;
 if target_business is null then raise exception 'Yalnızca size ait teslim edilmiş siparişi değerlendirebilirsiniz.' using errcode='42501'; end if;
 -- Retries after a lost response are idempotent and never add another vote.
 if exists(select 1 from public.order_rating_receipts where order_id=p_order and user_id=p_user) then return jsonb_build_object('ok',true); end if;
 select max(created_at) into delivery_at from public.order_messages where order_id=p_order and user_id=p_user and status='delivered';
 if delivery_at is null then raise exception 'Siparişin teslim bilgisi doğrulanamadı.' using errcode='42501'; end if;
 -- Reuse all existing ownership, publication, half-star and rate-limit checks.
 perform public.submit_business_star(p_user,target_business,p_rating);
 insert into public.order_rating_receipts(order_id,user_id,business_id,rating) values(p_order,p_user,target_business,p_rating);
 -- Acknowledgement is committed with the vote and receipt, never before a successful vote.
 update public.order_messages set read_at=now() where user_id=p_user and order_id=p_order and created_at<=delivery_at and read_at is null;
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.submit_order_business_rating(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.submit_order_business_rating(uuid,uuid,numeric) to service_role;
commit;
notify pgrst,'reload schema';
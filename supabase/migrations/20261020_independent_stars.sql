-- Caddeden: independent half-star ratings and administrator-controlled experience access.
-- Additive tables only. Existing accounts, businesses, reviews, orders and reservations are preserved.
-- This migration does not approve the feature or seed any user votes.
begin;
create table if not exists public.experience_feature_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.user_profiles(id) on delete set null
);
alter table public.experience_feature_settings enable row level security;
revoke all on public.experience_feature_settings from anon,authenticated;
grant all on public.experience_feature_settings to service_role;
insert into public.experience_feature_settings(id,enabled) values(true,false) on conflict(id) do nothing;
create table if not exists public.business_star_ratings (
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 rating numeric(2,1) not null check(rating between 0.5 and 5 and rating*2=trunc(rating*2)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(business_id,user_id)
);
alter table public.business_star_ratings enable row level security;
revoke all on public.business_star_ratings from anon,authenticated;
grant select on public.business_star_ratings to authenticated;
grant all on public.business_star_ratings to service_role;
comment on table public.business_star_ratings is 'One independent half-star vote per customer/business. Public reads expose only aggregates; writes are verified by rating-api.';
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_star_ratings' and policyname='authenticated_select_own_star_rating') then
  create policy authenticated_select_own_star_rating on public.business_star_ratings for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
create or replace function public.experiences_enabled() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select enabled from public.experience_feature_settings where id=true),false);
$$;
revoke all on function public.experiences_enabled() from public;
grant execute on function public.experiences_enabled() to anon,authenticated,service_role;
create or replace function public.business_star_stats(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(s.id::text,jsonb_build_object('rating',s.rating,'count',s.total)),'{}'::jsonb)
 from (
 select b.id,coalesce(round(avg(r.rating),1),0) as rating,count(r.user_id) as total
 from public.businesses b left join public.business_star_ratings r on r.business_id=b.id
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=r.user_id)
 where b.id=any(p_ids) and ((b.approval_status='approved' and b.is_published) or b.owner_id=auth.uid() or public.feedback_admin_allowed())
 group by b.id
 ) s;
$$;
revoke all on function public.business_star_stats(uuid[]) from public;
grant execute on function public.business_star_stats(uuid[]) to anon,authenticated,service_role;
create or replace function public.business_star_state(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare stats jsonb; own_score numeric; eligible boolean;
begin
 stats:=public.business_star_stats(array[p_business_id])->p_business_id::text;
 if stats is null then raise exception 'İşletme bulunamadı.' using errcode='42501'; end if;
 select rating into own_score from public.business_star_ratings where business_id=p_business_id and user_id=auth.uid();
 select exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and not exists(select 1 from public.businesses b where b.owner_id=p.id)
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) into eligible;
 return jsonb_build_object('rating',stats->'rating','count',stats->'count','mine',own_score,'canRate',eligible);
end; $$;
revoke all on function public.business_star_state(uuid) from public;
grant execute on function public.business_star_state(uuid) to anon,authenticated,service_role;
-- Only rating-api can supply p_user, after validating the session and confirmed email.
create or replace function public.submit_business_star(p_user uuid,p_business_id uuid,p_rating numeric) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_at timestamptz;
begin
 if p_rating is null or p_rating not between 0.5 and 5 or p_rating*2<>trunc(p_rating*2) then raise exception '0,5 ile 5 arasında, yarım yıldız adımlarıyla puan seçin.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,20261020));
 if not exists(select 1 from public.user_profiles p where p.id=p_user and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now()))
 or exists(select 1 from public.businesses where owner_id=p_user)
 or exists(select 1 from public.account_deletion_requests where user_id=p_user) then
 raise exception 'Yalnızca aktif müşteri hesapları puan verebilir.' using errcode='42501'; end if;
 if not exists(select 1 from public.businesses where id=p_business_id and approval_status='approved' and is_published) then
 raise exception 'İşletme yayında değil.' using errcode='42501'; end if;
 select max(updated_at) into previous_at from public.business_star_ratings where user_id=p_user;
 if previous_at>now()-interval '2 seconds' then raise exception 'Tekrar puan vermeden önce birkaç saniye bekleyin.' using errcode='P0001'; end if;
 insert into public.business_star_ratings(business_id,user_id,rating) values(p_business_id,p_user,p_rating)
 on conflict(business_id,user_id) do update set rating=excluded.rating,updated_at=now();
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.submit_business_star(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.submit_business_star(uuid,uuid,numeric) to service_role;
create or replace function public.set_experience_feature(p_actor uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_enabled is null or not exists(select 1 from public.user_profiles where id=p_actor and role='admin' and status='active' and lower(email)='caddeden.app@gmail.com') then
 raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 insert into public.experience_feature_settings(id,enabled,updated_by,updated_at) values(true,p_enabled,p_actor,now())
 on conflict(id) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.admin_logs(admin_id,action,detail) values(p_actor,'set_experiences_enabled',jsonb_build_object('enabled',p_enabled));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.set_experience_feature(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_experience_feature(uuid,boolean) to service_role;
-- Enforce the switch before the legacy RPC accesses any review data or performs any review write.
-- Preserve existing complaint, moderation and account-deletion branches and privileges.
do $migration$
declare source text;
begin
 select pg_get_functiondef('public.feedback_write(text,jsonb)'::regprocedure) into source;
 source:=replace(source,E'\r',''); -- yalnızca CRLF satır sonu toleransı; sözleşme kontrolü aşağıda aynen duruyor
 if strpos(source,'-- experience_feature_gate')=0 then
  if strpos(source,E'begin\n')=0 then raise exception 'Unexpected feedback_write entry contract'; end if;
  source:=replace(source,E'begin\n',E'begin\n -- experience_feature_gate\n if p_action in (''review'',''delete_review'',''suggest'',''support'',''review_reply'',''suggestion_reply'') and not public.experiences_enabled() then\n raise exception ''Müşteri deneyimleri yönetici onayı bekliyor.'' using errcode=''42501''; end if;\n');
  execute source;
 end if;
 select pg_get_functiondef('public.feedback_read(uuid,text,integer)'::regprocedure) into source;
 source:=replace(source,E'\r','');
 if strpos(source,'-- experience_feature_gate')=0 then
  if strpos(source,E'begin\n')=0 then raise exception 'Unexpected feedback_read entry contract'; end if;
  source:=replace(source,E'begin\n',E'begin\n -- experience_feature_gate\n if not public.experiences_enabled() and not public.feedback_admin_allowed() then\n raise exception ''Müşteri deneyimleri yönetici onayı bekliyor.'' using errcode=''42501''; end if;\n');
  execute source;
 end if;
end; $migration$;
commit;

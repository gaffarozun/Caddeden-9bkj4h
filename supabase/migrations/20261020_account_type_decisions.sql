-- Explicit admin decisions for legacy user-role business owners. Ownership/history remain intact.
begin;
create table if not exists public.account_type_decisions (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 role text not null check(role in ('user','business')),
 decided_by uuid not null references public.user_profiles(id),
 decided_at timestamptz not null default now()
);
alter table public.account_type_decisions enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='account_type_decisions' and policyname='authenticated_select_own_account_decision') then
 create policy authenticated_select_own_account_decision on public.account_type_decisions for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
-- No client insert/update/delete policies: decisions must use the authenticated admin API.
create or replace function public.account_type_pending(p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles where id=p_user and role='user')
 and exists(select 1 from public.businesses where owner_id=p_user)
 and not exists(select 1 from public.account_type_decisions where user_id=p_user);
$$;
revoke all on function public.account_type_pending(uuid) from public;
grant execute on function public.account_type_pending(uuid) to authenticated,anon,service_role;
create or replace function public.account_customer()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and coalesce(public.account_role()='user',false) and not public.account_type_pending(auth.uid());
$$;
create or replace function public.admin_set_account_type(p_admin uuid,p_user uuid,p_role text,p_expected text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old_role text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null)
 then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_role not in ('user','business') or p_expected not in ('user','business') or p_user=p_admin then raise exception 'Geçersiz hesap türü.' using errcode='22023'; end if;
 select role into old_role from public.user_profiles where id=p_user for update;
 if old_role is null or old_role='admin' then raise exception 'Bu hesabın türü değiştirilemez.' using errcode='42501'; end if;
 if old_role<>p_expected then raise exception 'Hesap türü değişmiş. Listeyi yenileyin.' using errcode='40001'; end if;
 update public.user_profiles set role=p_role where id=p_user;
 insert into public.account_type_decisions(user_id,role,decided_by) values(p_user,p_role,p_admin)
 on conflict(user_id) do update set role=excluded.role,decided_by=excluded.decided_by,decided_at=now();
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'set_account_type',jsonb_build_object('user_id',p_user,'before',old_role,'after',p_role,'ownership_preserved',true));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.admin_set_account_type(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_account_type(uuid,uuid,text,text) to service_role;
do $$ declare definition text; begin
 select pg_get_functiondef('public.submit_business_star(uuid,uuid,numeric)'::regprocedure) into definition;
 definition:=replace(definition,'or exists(select 1 from public.businesses where owner_id=p_user)','or public.account_type_pending(p_user)');
 -- Always reject self-rating, including owners explicitly classified as customer.
 if position('Kendi işletmenizi puanlayamazsınız.' in definition)=0 then
  definition:=replace(definition,'perform pg_advisory_xact_lock','if exists(select 1 from public.businesses where id=p_business_id and owner_id=p_user) then raise exception ''Kendi işletmenizi puanlayamazsınız.'' using errcode=''42501''; end if; perform pg_advisory_xact_lock');
 end if;
 execute definition;
 select pg_get_functiondef('public.feedback_actor(boolean)'::regprocedure) into definition;
 definition:=replace(definition,'exists(select 1 from public.businesses where owner_id=u)','public.account_type_pending(u)');
 execute definition;
end; $$;
commit;

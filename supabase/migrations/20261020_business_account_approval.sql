-- Business-account login approval: additive schema and authorization only.
-- No existing accounts, roles, businesses or transaction records are changed.
begin;
create table if not exists public.business_account_approvals (
 user_id uuid primary key references public.user_profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved')),
 created_at timestamptz not null default now(),
 decided_by uuid references public.user_profiles(id),
 decided_at timestamptz,
 constraint business_approval_decision_valid check (status <> 'approved' or (decided_by is not null and decided_at is not null))
);
alter table public.business_account_approvals enable row level security;
revoke all on public.business_account_approvals from public,anon,authenticated;
grant select on public.business_account_approvals to authenticated;
grant all on public.business_account_approvals to service_role;
-- Accounts may read only their own decision; no client write policies exist.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='business_account_approvals' and policyname='authenticated_select_own_business_approval') then
  create policy authenticated_select_own_business_approval on public.business_account_approvals for select to authenticated using (user_id=auth.uid());
 end if;
end; $$;

create or replace function public.account_active() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
 and (p.role <> 'business' or exists(select 1 from public.business_account_approvals a where a.user_id=p.id and a.status='approved')));
$$;
-- Used even before an account has created its first business.
create or replace function public.account_business_access() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_admin() or (public.account_active() and coalesce(public.account_role()='business',false));
$$;
create or replace function public.business_account_state() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('status',coalesce(a.status,'pending'),'canManage',public.account_business_access(),'decidedAt',a.decided_at)
 from public.user_profiles p left join public.business_account_approvals a on a.user_id=p.id
 where p.id=auth.uid() and p.role='business';
$$;
revoke all on function public.account_business_access(),public.business_account_state() from public,anon;
grant execute on function public.account_business_access(),public.business_account_state() to authenticated,service_role;

create or replace function public.business_account_approval_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.role='business' then
  if tg_op='UPDATE' then
   if old.role is not distinct from new.role then return new; end if;
  end if;
  insert into public.business_account_approvals(user_id,status) values(new.id,'pending')
  on conflict(user_id) do update set status='pending',decided_by=null,decided_at=null;
  insert into public.admin_alerts(type,ref_id,title,body)
  values('business_account_approval',new.id,'İşletme hesabı onay bekliyor','Yeni işletme hesabını Kullanıcılar bölümünden inceleyip giriş erişimini onaylayabilirsiniz.');
 end if;
 return new;
end; $$;
revoke all on function public.business_account_approval_request() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.user_profiles'::regclass and tgname='business_account_approval_request') then
  create trigger business_account_approval_request after insert or update of role on public.user_profiles for each row execute function public.business_account_approval_request();
 end if;
end; $$;

create or replace function public.admin_set_business_account_approval(p_admin uuid,p_user uuid,p_status text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_role text; previous_status text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
  where p.id=p_admin and p.role='admin' and p.status='active'
  and (p.restricted_until is null or p.restricted_until<=now())
  and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null and u.deleted_at is null
  and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('pending','approved') or p_user is null or p_user=p_admin then
  raise exception 'Geçersiz işletme hesabı onayı.' using errcode='22023';
 end if;
 select role into target_role from public.user_profiles where id=p_user for update;
 if target_role is distinct from 'business' then
  raise exception 'Yalnızca işletme hesaplarının giriş onayı değiştirilebilir.' using errcode='42501';
 end if;
 select status into previous_status from public.business_account_approvals where user_id=p_user;
 insert into public.business_account_approvals(user_id,status,decided_by,decided_at)
 values(p_user,p_status,p_admin,now()) on conflict(user_id) do update
 set status=excluded.status,decided_by=excluded.decided_by,decided_at=excluded.decided_at;
 insert into public.admin_logs(admin_id,action,detail)
 values(p_admin,'business_account_approval',jsonb_build_object('user_id',p_user,'before',coalesce(previous_status,'pending'),'after',p_status));
 return jsonb_build_object('ok',true,'status',p_status);
end; $$;
revoke all on function public.admin_set_business_account_approval(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_set_business_account_approval(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;

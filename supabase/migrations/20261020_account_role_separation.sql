-- Caddeden: additive role separation for profiles, businesses, requests, media and feedback.
-- No existing accounts, roles, ownership, transactions or media are migrated or removed.
begin;

create or replace function public.account_role()
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select role from public.user_profiles where id=auth.uid();
$$;
create or replace function public.account_active()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.status='active' and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id));
$$;
create or replace function public.account_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.role='admin' and lower(u.email)='caddeden.app@gmail.com');
$$;
create or replace function public.account_customer()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_active() and coalesce(public.account_role()='user',false)
 and not exists(select 1 from public.businesses b where b.owner_id=auth.uid());
$$;
create or replace function public.account_can_manage(p_business uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_admin() or (public.account_active() and coalesce(public.account_role()='business',false)
 and exists(select 1 from public.businesses b where b.id=p_business and b.owner_id=auth.uid()));
$$;
create or replace function public.account_media_owner(p_path text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.account_admin() or exists(select 1 from public.businesses b
 where b.id::text=split_part(p_path,'/',1) and public.account_can_manage(b.id));
$$;
revoke all on function public.account_role(), public.account_active(), public.account_admin(), public.account_customer(), public.account_can_manage(uuid), public.account_media_owner(text) from public;
grant execute on function public.account_role(), public.account_active(), public.account_admin(), public.account_customer(), public.account_can_manage(uuid), public.account_media_owner(text) to anon,authenticated,service_role;

-- Only the initial signup may read the requested account type. Metadata updates never change roles.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare assigned_role text := 'user';
begin
 if new.raw_user_meta_data->>'role'='business' then assigned_role:='business'; end if;
 if lower(trim(new.email))='caddeden.app@gmail.com' and new.email_confirmed_at is not null then assigned_role:='admin'; end if;
 insert into public.user_profiles(id,username,email,role,phone,first_name,last_name,gender)
 values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),new.email,assigned_role,
 new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'last_name',
 case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' else null end);
 return new;
end; $$;
create or replace function public.protect_user_profile_cols()
returns trigger language plpgsql as $$
declare jwt_role text:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','');
begin
 if jwt_role in ('authenticated','anon') or current_user in ('authenticated','anon') then
  if new.role is distinct from old.role then raise exception 'Hesap türünü yalnızca yönetici belirleyebilir.' using errcode='42501'; end if;
  new.status:=old.status; new.restricted_until:=old.restricted_until;
 end if;
 return new;
end; $$;

-- Service-only atomic admin decision with audit; no automatic legacy account conversion.
create or replace function public.admin_set_account_type(p_admin uuid,p_user uuid,p_role text,p_expected text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old_role text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
 where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null)
 then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_role not in ('user','business') or p_expected not in ('user','business') or p_user=p_admin then raise exception 'Geçersiz hesap türü.' using errcode='22023'; end if;
 select role into old_role from public.user_profiles where id=p_user for update;
 if old_role is null or old_role='admin' then raise exception 'Bu hesabın türü değiştirilemez.' using errcode='42501'; end if;
 if old_role<>p_expected then raise exception 'Hesap türü değişmiş. Listeyi yenileyin.' using errcode='40001'; end if;
 update public.user_profiles set role=p_role where id=p_user;
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'set_account_type',jsonb_build_object('user_id',p_user,'before',old_role,'after',p_role,'ownership_preserved',true));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.admin_set_account_type(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_account_type(uuid,uuid,text,text) to service_role;

-- Restrictive policies intersect existing permissive policies instead of replacing them.
-- This preserves public visibility and approval rules while adding role requirements.
do $$
declare op text; t text; predicate text; policy_name text;
begin
 foreach op in array array['insert','update','delete'] loop
  predicate:='(public.account_admin() or (public.account_active() and public.account_role()=''business'' and owner_id=auth.uid()))';
  policy_name:='authenticated_'||op||'_account_business';
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='businesses' and policyname=policy_name) then
   if op='insert' then execute format('create policy %I on public.businesses as restrictive for insert to authenticated with check (%s)',policy_name,predicate);
   elsif op='update' then execute format('create policy %I on public.businesses as restrictive for update to authenticated using (%s) with check (%s)',policy_name,predicate,predicate);
   else execute format('create policy %I on public.businesses as restrictive for delete to authenticated using (%s)',policy_name,predicate); end if;
  end if;
 end loop;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='businesses' and policyname='authenticated_select_account_business') then
  create policy authenticated_select_account_business on public.businesses as restrictive for select to authenticated using ((approval_status='approved' and is_published) or public.account_can_manage(id));
 end if;
 foreach t in array array['menu_items','business_posts','campaigns','ads','notification_requests'] loop
  foreach op in array array['insert','update','delete'] loop
   predicate:='public.account_can_manage(business_id)'; policy_name:='authenticated_'||op||'_account_owner';
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=policy_name) then
    if op='insert' then execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)',policy_name,t,predicate);
    elsif op='update' then execute format('create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)',policy_name,t,predicate,predicate);
    else execute format('create policy %I on public.%I as restrictive for delete to authenticated using (%s)',policy_name,t,predicate); end if;
   end if;
  end loop;
 end loop;
 foreach t in array array['orders','reservations'] loop
  foreach op in array array['select','insert','update','delete'] loop
   policy_name:='authenticated_'||op||'_account_request';
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=policy_name) then
    if op='select' then execute format('create policy %I on public.%I as restrictive for select to authenticated using (user_id=auth.uid() or public.account_can_manage(business_id))',policy_name,t);
    elsif op='insert' then execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (user_id=auth.uid() and public.account_customer())',policy_name,t);
    elsif op='update' then execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.account_can_manage(business_id)) with check (public.account_can_manage(business_id))',policy_name,t);
    else execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.account_admin())',policy_name,t); end if;
   end if;
  end loop;
 end loop;
 foreach t in array array['ads','notification_requests','payments'] loop
  policy_name:='authenticated_select_account_private';
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=policy_name) then
   execute format('create policy %I on public.%I as restrictive for select to authenticated using (public.account_can_manage(business_id))',policy_name,t);
  end if;
 end loop;
 foreach op in array array['insert','update','delete'] loop
  policy_name:='authenticated_'||op||'_account_media';
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname=policy_name) then
   predicate:='(bucket_id<>''business-media'' or public.account_media_owner(name))';
   if op='insert' then execute format('create policy %I on storage.objects as restrictive for insert to authenticated with check (%s)',policy_name,predicate);
   elsif op='update' then execute format('create policy %I on storage.objects as restrictive for update to authenticated using (%s) with check (%s)',policy_name,predicate,predicate);
   else execute format('create policy %I on storage.objects as restrictive for delete to authenticated using (%s)',policy_name,predicate); end if;
  end if;
 end loop;
end; $$;

-- Defense in depth: role + identity guards also protect authenticated direct writes.
create or replace function public.account_request_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; item jsonb; mi public.menu_items; computed numeric:=0; qty integer;
begin
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','')='service_role' or public.account_admin() then return new; end if;
 if tg_op='UPDATE' then
  if not public.account_can_manage(old.business_id) then raise exception 'Yalnızca kendi işletmenizin taleplerini yönetebilirsiniz.' using errcode='42501'; end if;
  if (to_jsonb(new)-array['status','cancelled_at']) is distinct from (to_jsonb(old)-array['status','cancelled_at']) then
   raise exception 'Yalnızca talep durumu değiştirilebilir.' using errcode='42501'; end if;
  if tg_table_name='orders' and new.status not in ('pending','approved','rejected','delivered') then raise exception 'Geçersiz sipariş durumu.' using errcode='22023'; end if;
  if tg_table_name='reservations' and new.status not in ('pending','approved','rejected','cancelled','completed') then raise exception 'Geçersiz talep durumu.' using errcode='22023'; end if;
  return new;
 end if;
 if not public.account_customer() or new.user_id<>auth.uid() then raise exception 'Bu işlem yalnızca müşteri hesaplarına açıktır.' using errcode='42501'; end if;
 select * into b from public.businesses where id=new.business_id for share;
 if b.id is null or b.approval_status<>'approved' or not b.is_published or b.owner_id=auth.uid() then raise exception 'İşletme işlem için uygun değil.' using errcode='42501'; end if;
 new.status:='pending';
 if coalesce(trim(new.phone),'')='' then raise exception 'Telefon numarası gerekli.' using errcode='22023'; end if;
 if tg_table_name='orders' then
  if b.category not in ('restoran','market') or not b.allow_order or not b.allow_menu then raise exception 'İşletme sipariş almıyor.' using errcode='42501'; end if;
  if coalesce(trim(new.address),'')='' or new.lat is null or new.lng is null then raise exception 'Teslimat adresi ve konumu gerekli.' using errcode='22023'; end if;
  if jsonb_typeof(new.items)<>'array' or jsonb_array_length(new.items) not between 1 and 100 then raise exception 'Geçerli sepet gerekli.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(new.items) loop
   qty:=(item->>'qty')::integer;
   if qty not between 1 and 99 or qty is null then raise exception 'Geçersiz ürün adedi.' using errcode='22023'; end if;
   select * into mi from public.menu_items where id=(item->>'menu_item_id')::uuid and business_id=b.id;
   if mi.id is null or mi.item_type<>'product' or (item->>'price')::numeric is distinct from mi.price then raise exception 'Menü veya fiyat değişmiş. Menüyü yenileyin.' using errcode='22023'; end if;
   computed:=computed+mi.price*qty;
  end loop;
  if computed<greatest(0,b.min_order) then raise exception 'Minimum sipariş tutarına ulaşılmadı.' using errcode='22023'; end if;
  new.total:=computed;
 else
  if not b.allow_reservation then raise exception 'İşletme rezervasyon/randevu almıyor.' using errcode='42501'; end if;
  if new.type not in ('appointment','reservation') or new.date<current_date or new.time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.guests not between 1 and 12 then raise exception 'Geçersiz rezervasyon bilgisi.' using errcode='22023'; end if;
  if new.type='appointment' and b.category not in ('kadin_kuafor','erkek_kuafor','guzellik','berber','guzellik_salonu','protez_tirnak','cilt_bakimi','kas_kirpik','makyaj','agda_epilasyon') then raise exception 'Bu işletme randevu sunmuyor.' using errcode='22023'; end if;
  if new.type='reservation' and b.category not in ('restoran','kafe','eglence','bar','club') then raise exception 'Bu işletme rezervasyon sunmuyor.' using errcode='22023'; end if;
  if new.type='appointment' and not exists(select 1 from public.menu_items where id=new.service_id and business_id=b.id and item_type='service') then raise exception 'İşletmeye ait bir hizmet seçin.' using errcode='22023'; end if;
  if new.type='reservation' and new.service_id is not null then raise exception 'Rezervasyon hizmet kimliği içeremez.' using errcode='22023'; end if;
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='account_request_guard') then create trigger account_request_guard before insert or update on public.orders for each row execute function public.account_request_guard(); end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.reservations'::regclass and tgname='account_request_guard') then create trigger account_request_guard before insert or update on public.reservations for each row execute function public.account_request_guard(); end if;
end; $$;

-- Preserve the existing feedback projections; strengthen only their ownership predicates.
do $$ declare definition text; begin
 select pg_get_functiondef('public.feedback_read(uuid,text,integer)'::regprocedure) into definition;
 definition:=replace(definition,'select owner_id=auth.uid(),approval_status=','select public.account_can_manage(id),approval_status=');
 execute definition;
 select pg_get_functiondef('public.feedback_write(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'where id=b and owner_id=u','where id=b and public.account_can_manage(id)');
 execute definition;
end; $$;
commit;

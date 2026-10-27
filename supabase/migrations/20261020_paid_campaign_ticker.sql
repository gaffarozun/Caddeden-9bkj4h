-- Paid campaign ticker: additive pricing snapshots, read gates and atomic admin decisions.
-- Existing campaigns, accounts, packages, policies and payment history are preserved.
begin;
alter table public.campaigns add column if not exists publication_days integer;

create or replace function public.campaign_pricing_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare pkg public.ad_packages; privileged boolean;
begin
 privileged:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='service_role' or current_user='service_role' or public.account_admin();
 if tg_op='INSERT' then
  if not privileged and (not public.account_active() or public.account_role()<>'business' or not public.account_can_manage(new.business_id) or not exists(select 1 from public.business_account_approvals where user_id=auth.uid() and status='approved')) then
   raise exception 'Kampanya başvurusu için onaylanmış işletme hesabı gerekli.' using errcode='42501';
  end if;
  select * into pkg from public.ad_packages where id=new.package_id for share;
  if pkg.id is null or pkg.type<>'content_campaign' or not pkg.active or pkg.price<=0 or pkg.duration_days<1 then
   raise exception 'Yönetici henüz ücretli kampanya paketi tanımlamamış veya seçilen paket satışta değil.' using errcode='22023';
  end if;
  new.title:=btrim(regexp_replace(coalesce(new.title,''),'[[:space:]]+',' ','g'));
  if char_length(new.title) not between 4 and 160 or char_length(coalesce(new.description,''))>2000 then
   raise exception 'Başlık 4–160, açıklama en fazla 2000 karakter olmalıdır.' using errcode='22023';
  end if;
  new.price:=pkg.price; new.publication_days:=pkg.duration_days;
  new.status:='pending'; new.payment_status:='unpaid'; new.rejection_reason:=null;
  new.start_date:=null; new.end_date:=null;
 else
  if not privileged then raise exception 'Kampanya ücretini, ödeme ve yayın durumunu yalnızca yönetici değiştirebilir.' using errcode='42501'; end if;
  if new.status='approved' and (new.payment_status<>'paid' or new.price<=0 or new.start_date is null or new.end_date is null or new.end_date<new.start_date) then
   raise exception 'Yayın için ücret, doğrulanmış ödeme ve geçerli yayın süresi gerekli.' using errcode='22023';
  end if;
 end if;
 return new;
end; $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.campaigns'::regclass and tgname='zzz_campaign_pricing_guard') then
  create trigger zzz_campaign_pricing_guard before insert or update on public.campaigns for each row execute function public.campaign_pricing_guard();
 end if;
 -- Restrictive gates intersect existing public and ownership policies, never replace them.
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='anon_select_paid_campaigns') then
  create policy anon_select_paid_campaigns on public.campaigns as restrictive for select to anon using (status='approved' and payment_status='paid' and price>0 and start_date<=current_date and end_date>=current_date);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='campaigns' and policyname='authenticated_select_paid_campaigns') then
  create policy authenticated_select_paid_campaigns on public.campaigns as restrictive for select to authenticated using (public.account_can_manage(business_id) or (status='approved' and payment_status='paid' and price>0 and start_date<=current_date and end_date>=current_date));
 end if;
end; $$;

create or replace function public.admin_campaign_decision(p_admin uuid,p_id uuid,p_action text,p_value text,p_reason text default null,p_expected_status text default null,p_expected_payment text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare campaign public.campaigns; days integer; previous text;
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com' and u.email_confirmed_at is not null and u.deleted_at is null and (p.restricted_until is null or p.restricted_until<=now()) and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_action is null or p_value is null or not ((p_action='status' and p_value in ('approved','rejected')) or (p_action='payment' and p_value in ('paid','unpaid'))) then raise exception 'Geçersiz kampanya kararı.' using errcode='22023'; end if;
 select * into campaign from public.campaigns where id=p_id for update;
 if campaign.id is null then raise exception 'Kampanya bulunamadı.' using errcode='22023'; end if;
 if (p_expected_status is not null and p_expected_status<>campaign.status) or (p_expected_payment is not null and p_expected_payment<>campaign.payment_status) then raise exception 'Kampanya durumu değişti. Listeyi yenileyin.' using errcode='40001'; end if;
 if p_action='status' then
  previous:=campaign.status;
  if p_value='approved' then
   if campaign.payment_status<>'paid' or campaign.price<=0 then raise exception 'Önce belirlenen ücretin ödemesini doğrulayın; ardından kampanyayı onaylayın.' using errcode='22023'; end if;
   days:=campaign.publication_days;
   if days is null then select duration_days into days from public.ad_packages where id=campaign.package_id and type='content_campaign'; end if;
   if days is null or days<1 then raise exception 'Geçerli ücretli kampanya paketi ve yayın süresi gerekli.' using errcode='22023'; end if;
   if campaign.status='approved' then return jsonb_build_object('ok',true); end if;
   update public.campaigns set status='approved',rejection_reason=null,publication_days=days,start_date=current_date,end_date=current_date+days-1 where id=p_id;
  else
   update public.campaigns set status='rejected',rejection_reason=left(nullif(btrim(p_reason),''),300) where id=p_id;
  end if;
 else
  previous:=campaign.payment_status;
  if p_value='paid' and campaign.price<=0 then raise exception 'Bu eski başvuruda ücret belirlenmemiş. İşletme ücretli paketle yeniden başvurmalıdır.' using errcode='22023'; end if;
  if p_value='unpaid' then
   update public.campaigns set payment_status='unpaid',status=case when status='approved' then 'pending' else status end,start_date=null,end_date=null where id=p_id;
  else
   update public.campaigns set payment_status='paid' where id=p_id;
   if not exists(select 1 from public.payments where note='campaign:'||p_id::text) then
    insert into public.payments(business_id,amount,status,method,note) values(campaign.business_id,campaign.price,'paid','manual','campaign:'||p_id::text);
   end if;
  end if;
 end if;
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'campaign_'||p_action,jsonb_build_object('id',p_id,'before',previous,'after',p_value,'manual_payment',true));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.admin_campaign_decision(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_campaign_decision(uuid,uuid,text,text,text,text,text) to service_role;

create or replace function public.public_paid_campaigns()
returns table(id uuid,business_id uuid,title text,description text,cover text,name text,category text)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.id,c.business_id,c.title,c.description,coalesce(nullif(c.image_url,''),nullif(b.cover_url,''),b.images->>0,nullif(b.logo_url,''),''),b.name,b.category
 from public.campaigns c join public.businesses b on b.id=c.business_id
 where c.status='approved' and c.payment_status='paid' and c.price>0 and c.start_date<=current_date and c.end_date>=current_date
 and b.approval_status='approved' and b.is_published
 order by c.created_at desc,c.id limit 100;
$$;
revoke all on function public.public_paid_campaigns() from public;
grant execute on function public.public_paid_campaigns() to anon,authenticated,service_role;

-- Quote checking and package lock run in a single transaction. Ownership and approval are explicit.
create or replace function public.submit_paid_campaign(p_business uuid,p_package uuid,p_title text,p_description text,p_image text,p_price numeric,p_days integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare pkg public.ad_packages; campaign_id uuid;
begin
 if not public.account_active() or public.account_role()<>'business' or not public.account_can_manage(p_business) or not exists(select 1 from public.business_account_approvals where user_id=auth.uid() and status='approved') then raise exception 'Onaylanmış yetkili işletme hesabı gerekli.' using errcode='42501'; end if;
 select * into pkg from public.ad_packages where id=p_package for share;
 if pkg.id is null or not pkg.active or pkg.type<>'content_campaign' or pkg.price<=0 or pkg.duration_days<1 then raise exception 'Yönetici henüz ücretli kampanya paketi tanımlamamış.' using errcode='22023'; end if;
 if p_price is distinct from pkg.price or p_days is distinct from pkg.duration_days then raise exception 'Paket fiyatı veya süresi değişti. Listeyi yenileyip yeni koşulları seçin.' using errcode='40001'; end if;
 insert into public.campaigns(business_id,package_id,title,description,image_url,price,publication_days)
 values(p_business,p_package,p_title,nullif(btrim(p_description),''),p_image,pkg.price,pkg.duration_days) returning id into campaign_id;
 return campaign_id;
end; $$;
revoke all on function public.submit_paid_campaign(uuid,uuid,text,text,text,numeric,integer) from public,anon;
grant execute on function public.submit_paid_campaign(uuid,uuid,text,text,text,numeric,integer) to authenticated;
create index if not exists campaigns_paid_ticker_idx on public.campaigns(start_date,end_date,created_at) where status='approved' and payment_status='paid' and price>0;
notify pgrst,'reload schema';
commit;

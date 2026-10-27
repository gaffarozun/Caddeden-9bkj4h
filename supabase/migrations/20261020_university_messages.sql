-- Add university LED messages and administrator moderation without changing existing accounts or records.
begin;
create table if not exists public.university_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 text text not null check (char_length(text) between 4 and 160),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 moderation_reason text check (char_length(moderation_reason)<=300),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 decided_at timestamptz,
 decided_by uuid references public.user_profiles(id) on delete set null
);
alter table public.university_messages enable row level security;
create index if not exists university_messages_status_created_idx on public.university_messages(status,created_at,id);
create index if not exists university_messages_author_idx on public.university_messages(user_id,created_at);
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='university_messages' and policyname='authenticated_select_own_university_messages') then
 -- Customers can see their own requests, including rejection feedback; no client mutation policies.
 create policy authenticated_select_own_university_messages on public.university_messages for select to authenticated using(user_id=auth.uid());
 end if;
end; $$;
revoke all on public.university_messages from anon,authenticated;
grant select on public.university_messages to authenticated;
grant all on public.university_messages to service_role;

-- The public projection exposes no author identifiers, private profiles or moderation details.
create or replace function public.university_public_messages()
returns table(id uuid,text text,published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select m.id,m.text,m.published_at from public.university_messages m
 join public.user_profiles p on p.id=m.user_id
 join auth.users u on u.id=p.id
 where m.status='approved' and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
 order by m.published_at asc,m.id asc;
$$;
revoke all on function public.university_public_messages() from public;
grant execute on function public.university_public_messages() to anon,authenticated,service_role;

create or replace function public.submit_university_message(p_text text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); content text; message_id uuid;
begin
 if actor is null or not public.account_customer() then
  raise exception 'Yazı göndermek için aktif bir kullanıcı hesabıyla giriş yapmalısınız.' using errcode='42501';
 end if;
 content:=btrim(regexp_replace(regexp_replace(coalesce(p_text,''),'[[:cntrl:]]',' ','g'),'[[:space:]]+',' ','g'));
 if char_length(content)<4 or char_length(content)>160 then raise exception 'Yazınız 4–160 karakter arasında olmalıdır.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':university-message',0));
 if exists(select 1 from public.university_messages where user_id=actor and created_at>now()-interval '60 seconds') then
  raise exception 'Yeni bir yazı göndermeden önce bir dakika bekleyin.' using errcode='22023';
 end if;
 if (select count(*) from public.university_messages where user_id=actor and status='pending')>=3 then
  raise exception 'En fazla üç yazınız onay bekleyebilir. Önce mevcut taleplerinizin değerlendirilmesini bekleyin.' using errcode='22023';
 end if;
 insert into public.university_messages(user_id,text) values(actor,content) returning id into message_id;
 insert into public.admin_alerts(type,ref_id,title,body) values('university_message',message_id,'Üniversiteden: yeni yazı isteği',left(content,160));
 return message_id;
end; $$;
revoke all on function public.submit_university_message(text) from public,anon;
grant execute on function public.submit_university_message(text) to authenticated;

-- Called only by the existing JWT-verified admin-api; decisions and audit are atomic.
create or replace function public.moderate_university_message(p_admin uuid,p_id uuid,p_status text,p_expected text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare previous text; reason text:=nullif(btrim(p_reason),'');
begin
 if not exists(select 1 from public.user_profiles p join auth.users u on u.id=p.id
  where p.id=p_admin and p.role='admin' and p.status='active' and lower(u.email)='caddeden.app@gmail.com'
  and (p.restricted_until is null or p.restricted_until<=now()) and u.email_confirmed_at is not null and u.deleted_at is null
  and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)) then
  raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
 end if;
 if p_status is null or p_status not in ('approved','rejected') or p_expected is null or p_expected not in ('pending','approved','rejected') or char_length(coalesce(reason,''))>300 then
  raise exception 'Geçersiz yayın kararı.' using errcode='22023';
 end if;
 select status into previous from public.university_messages where id=p_id for update;
 if previous is null then raise exception 'Yazı bulunamadı.' using errcode='22023'; end if;
 if previous<>p_expected then raise exception 'Yazının durumu değişti. Listeyi yenileyin.' using errcode='40001'; end if;
 update public.university_messages set status=p_status, moderation_reason=case when p_status='rejected' then reason else null end,
 published_at=case when p_status='approved' then coalesce(published_at,now()) else null end,
 decided_at=now(),decided_by=p_admin where id=p_id;
 insert into public.admin_logs(admin_id,action,detail) values(p_admin,'moderate_university_message',jsonb_build_object('id',p_id,'before',previous,'after',p_status));
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.moderate_university_message(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.moderate_university_message(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;

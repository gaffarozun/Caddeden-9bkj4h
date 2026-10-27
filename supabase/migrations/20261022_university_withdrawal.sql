-- Add withdrawal support to university_messages; preserve existing rows, decisions and RLS.
begin;
alter table public.university_messages add column if not exists withdrawn_at timestamptz;
alter table public.university_messages add column if not exists withdrawn_by uuid references public.user_profiles(id) on delete set null;
comment on column public.university_messages.withdrawn_at is 'Removed from the TV feed by the author or authorized administrator; historical row is retained.';

create or replace function public.withdraw_university_message(p_id uuid)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); item public.university_messages; administrator boolean; withdrawn timestamptz;
begin
 if actor is null then raise exception 'Yazı kaldırmak için giriş yapmalısınız.' using errcode='42501'; end if;
 administrator:=public.account_admin();
 select * into item from public.university_messages where id=p_id and (user_id=actor or administrator) for update;
 if not found then raise exception 'Yazı bulunamadı veya kaldırma yetkiniz yok.' using errcode='42501'; end if;
 if item.withdrawn_at is not null then return item.withdrawn_at; end if;
 withdrawn:=now();
 update public.university_messages set withdrawn_at=withdrawn,withdrawn_by=actor where id=item.id;
 if administrator then
  insert into public.admin_logs(admin_id,action,detail) values(actor,'withdraw_university_message',jsonb_build_object('id',item.id,'previous_status',item.status));
 end if;
 return withdrawn;
end; $$;
revoke all on function public.withdraw_university_message(uuid) from public,anon;
grant execute on function public.withdraw_university_message(uuid) to authenticated;

-- Serialize moderation/removal on the same row and prevent resurrection of withdrawn content.
create or replace function public.university_withdrawal_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.withdrawn_at is not null and (new.withdrawn_at is distinct from old.withdrawn_at or (new.withdrawn_by is distinct from old.withdrawn_by and new.withdrawn_by is not null) or new.status is distinct from old.status or new.text is distinct from old.text) then
  raise exception 'Kaldırılan yazı tekrar yayınlanamaz. Yeni bir yazı isteği gönderilmelidir.' using errcode='40001';
 end if;
 return new;
end; $$;
revoke all on function public.university_withdrawal_guard() from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.university_messages'::regclass and tgname='university_withdrawal_guard') then
  create trigger university_withdrawal_guard before update on public.university_messages for each row execute function public.university_withdrawal_guard();
 end if;
end; $$;

create or replace function public.university_public_messages()
returns table(id uuid,text text,published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select m.id,m.text,m.published_at from public.university_messages m
 join public.user_profiles p on p.id=m.user_id
 join auth.users u on u.id=p.id
 where m.status='approved' and m.withdrawn_at is null and p.role='user' and p.status='active'
 and (p.restricted_until is null or p.restricted_until<=now())
 and u.email_confirmed_at is not null and u.deleted_at is null
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
 order by m.published_at asc,m.id asc;
$$;
revoke all on function public.university_public_messages() from public;
grant execute on function public.university_public_messages() to anon,authenticated,service_role;

-- Keep validation and anti-spam throttle. Withdrawn pending requests no longer occupy quota.
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
 if (select count(*) from public.university_messages where user_id=actor and status='pending' and withdrawn_at is null)>=3 then
  raise exception 'En fazla üç yazınız onay bekleyebilir. Önce mevcut taleplerinizin değerlendirilmesini bekleyin.' using errcode='22023';
 end if;
 insert into public.university_messages(user_id,text) values(actor,content) returning id into message_id;
 insert into public.admin_alerts(type,ref_id,title,body) values('university_message',message_id,'Üniversiteden: yeni yazı isteği',left(content,160));
 return message_id;
end; $$;
revoke all on function public.submit_university_message(text) from public,anon;
grant execute on function public.submit_university_message(text) to authenticated;
notify pgrst,'reload schema';
commit;

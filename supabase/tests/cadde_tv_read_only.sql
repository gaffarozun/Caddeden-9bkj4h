-- Read-only Cadde TV regression checks; no records are changed.
-- Broadcasting uses Europe/Istanbul independently of the database session timezone.
do $$ begin
 if not has_function_privilege('anon','public.public_cadde_tv_channels()','execute') then raise exception 'Public TV read permission missing'; end if;
 if not has_function_privilege('authenticated','public.submit_university_message(text)','execute') then raise exception 'Student submission permission missing'; end if;
 if has_function_privilege('anon','public.submit_university_message(text)','execute') then raise exception 'Anonymous student submission exposed'; end if;
 if exists(select 1 from public.public_cadde_tv_channels() c join public.businesses b on b.id=c.business_id where b.approval_status<>'approved' or not b.is_published) then raise exception 'Unpublished business exposed'; end if;
 if exists(select 1 from public.public_cadde_tv_channels() c join public.ads a on a.id=c.id where c.sponsored and (a.status<>'active' or a.payment_status<>'paid' or a.start_date is null or a.end_date is null or nullif(btrim(a.image_url),'') is null or a.start_date>(now() at time zone 'Europe/Istanbul')::date or a.end_date<(now() at time zone 'Europe/Istanbul')::date)) then raise exception 'Ineligible ad exposed'; end if;
 if exists(select 1 from public.public_cadde_tv_channels() c join public.business_posts p on p.id=c.id where not c.sponsored and (p.kind<>'reel' or p.status<>'approved' or (p.price>0 and p.payment_status<>'paid') or nullif(btrim(p.image_url),'') is null or p.start_date>(now() at time zone 'Europe/Istanbul')::date or p.end_date<(now() at time zone 'Europe/Istanbul')::date)) then raise exception 'Ineligible content exposed'; end if;
 if position('Europe/Istanbul' in pg_get_functiondef('public.public_cadde_tv_channels()'::regprocedure))=0 then raise exception 'Broadcast timezone missing'; end if;
 -- Fixed midnight regression: Turkey is already on the 21st while Bogota remains on the 20th.
 if (timestamptz '2026-10-21 01:00:00+00' at time zone 'Europe/Istanbul')::date<>date '2026-10-21' or (timestamptz '2026-10-21 01:00:00+00' at time zone 'America/Bogota')::date<>date '2026-10-20' then raise exception 'Timezone fixture failed'; end if;
 if not (select relrowsecurity from pg_class where oid='public.university_messages'::regclass) then raise exception 'Student RLS missing'; end if;
 if not (select relrowsecurity from pg_class where oid='public.ads'::regclass) then raise exception 'Ad RLS missing'; end if;
 if not (select relrowsecurity from pg_class where oid='public.business_posts'::regclass) then raise exception 'Content RLS missing'; end if;
end; $$;
begin;
set local role anon;
select count(*) as visible_tv_channels from public.public_cadde_tv_channels();
reset role;
rollback;

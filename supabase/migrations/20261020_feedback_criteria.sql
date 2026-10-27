-- Caddeden: additive per-feature ratings and direct publication of new reviews/replies.
-- Existing reviews, moderation decisions, accounts and ownership rules remain intact.
begin;
alter table public.business_reviews add column if not exists criteria_ratings jsonb not null default '{}'::jsonb;

create or replace function public.feedback_criteria_valid(p_scores jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare k text; v jsonb; total integer:=0;
begin
 if p_scores is null or jsonb_typeof(p_scores)<>'object' then return false; end if;
 for k,v in select key,value from jsonb_each(p_scores) loop
  if k not in ('price','hygiene','staff','service','environment','variety') or jsonb_typeof(v)<>'number' then return false; end if;
  if (v::text)::numeric not between 1 and 5 or (v::text)::numeric<>trunc((v::text)::numeric) then return false; end if;
  total:=total+1;
 end loop;
 return total=6;
end; $$;

create or replace function public.feedback_review_score(p_scores jsonb,p_fallback integer) returns numeric
language sql immutable set search_path=public,pg_temp as $$
 select case when public.feedback_criteria_valid(p_scores)
 then (select round(avg(value::numeric),1) from jsonb_each_text(p_scores))
 else p_fallback::numeric end;
$$;

-- Empty objects are the legacy representation; new submissions require all six scores.
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.business_reviews'::regclass and conname='business_reviews_criteria_valid') then
  alter table public.business_reviews add constraint business_reviews_criteria_valid check(criteria_ratings='{}'::jsonb or public.feedback_criteria_valid(criteria_ratings));
 end if;
end; $$;

-- Patch only known branches. Abort atomically if the installed contract differs.
do $migration$
declare source text; start_at integer; end_at integer; replacement text;
begin
 select pg_get_functiondef(oid) into source from pg_proc where pronamespace='public'::regnamespace and proname='feedback_write';
 start_at:=strpos(source,'if p_action=''review'' then');
 end_at:=strpos(source,'elsif p_action=''delete_review'' then');
 if start_at=0 or end_at<=start_at then raise exception 'feedback_write review contract differs'; end if;
 replacement:=$branch$if p_action='review' then
 b:=(p_data->>'business_id')::uuid;
 if not exists(select 1 from public.businesses where id=b and approval_status='approved' and is_published) then raise exception 'İşletme yayında değil.'; end if;
 if not public.feedback_criteria_valid(p_data->'criteria_ratings') then raise exception 'Altı özelliğin her biri için 1–5 yıldız seçin.'; end if;
 txt:=trim(coalesce(p_data->>'comment',''));
 if char_length(txt)>2000 then raise exception 'Yorum en fazla 2000 karakter olmalı.'; end if;
 n:=round(public.feedback_review_score(p_data->'criteria_ratings',0))::integer;
 select key into st from jsonb_each_text(p_data->'criteria_ratings') order by value::integer desc,key limit 1;
 insert into public.business_reviews(business_id,user_id,rating,comment,topic,criteria_ratings,status)
 values(b,u,n,txt,st,p_data->'criteria_ratings','published')
 on conflict(business_id,user_id) do update set rating=excluded.rating,comment=excluded.comment,topic=excluded.topic,
 criteria_ratings=excluded.criteria_ratings,
 status=case when business_reviews.status='hidden' then 'pending' else 'published' end,
 moderation_reason=case when business_reviews.status='hidden' then business_reviews.moderation_reason else null end,
 updated_at=now();
 $branch$;
 source:=substr(source,1,start_at-1)||replacement||substr(source,end_at);
 replacement:='update public.business_reviews set reply=txt,reply_status=''pending'',reply_reason=null,reply_updated_at=now() where id=item;';
 if strpos(source,replacement)=0 then raise exception 'feedback_write reply contract differs'; end if;
 source:=replace(source,replacement,'update public.business_reviews set reply=txt,reply_status=case when reply_status=''hidden'' then ''pending'' else ''published'' end,reply_reason=case when reply_status=''hidden'' then reply_reason else null end,reply_updated_at=now() where id=item;');
 execute source;

 select pg_get_functiondef(oid) into source from pg_proc where pronamespace='public'::regnamespace and proname='feedback_read';
 replacement:='select id,rating,comment,topic,created_at,updated_at';
 if strpos(source,replacement)=0 then raise exception 'feedback_read public projection differs'; end if;
 source:=replace(source,replacement,'select id,public.feedback_review_score(criteria_ratings,rating) as rating,comment,topic,criteria_ratings,created_at,updated_at');
 replacement:='select id,rating,comment,topic,status,moderation_reason,created_at,updated_at';
 if strpos(source,replacement)=0 then raise exception 'feedback_read personal projection differs'; end if;
 source:=replace(source,replacement,'select id,public.feedback_review_score(criteria_ratings,rating) as rating,comment,topic,criteria_ratings,status,moderation_reason,created_at,updated_at');
 replacement:='select topic,count(distinct user_id) as count from public.business_reviews where business_id=p_business_id and status=''published'' and rating>=4 group by topic having count(distinct user_id)>=3 order by count desc,topic limit 1';
 if strpos(source,replacement)=0 then raise exception 'feedback_read highlights contract differs'; end if;
 source:=replace(source,replacement,'select features.key as topic,count(distinct r.user_id) as count from public.business_reviews r cross join lateral jsonb_each_text(case when public.feedback_criteria_valid(r.criteria_ratings) then r.criteria_ratings else jsonb_build_object(r.topic,r.rating) end) features where r.business_id=p_business_id and r.status=''published'' and features.value::numeric>=4 group by features.key having count(distinct r.user_id)>=3 order by count desc,features.key limit 1');
 source:=replace(source,'case when p_sort=''highest'' then rating end','case when p_sort=''highest'' then public.feedback_review_score(criteria_ratings,rating) end');
 source:=replace(source,'case when p_sort=''lowest'' then rating end','case when p_sort=''lowest'' then public.feedback_review_score(criteria_ratings,rating) end');
 execute source;

 select pg_get_functiondef(oid) into source from pg_proc where pronamespace='public'::regnamespace and proname='feedback_ratings';
 replacement:='round(avg(rating),1)';
 if strpos(source,replacement)=0 then raise exception 'feedback_ratings aggregation contract differs'; end if;
 source:=replace(source,replacement,'round(avg(public.feedback_review_score(criteria_ratings,rating)),1)');
 execute source;
end;
$migration$;

revoke all on function public.feedback_criteria_valid(jsonb),public.feedback_review_score(jsonb,integer) from public,anon,authenticated;
-- Constraint evaluation requires the safe, immutable validator; it exposes no table data.
grant execute on function public.feedback_criteria_valid(jsonb) to authenticated,service_role;
commit;

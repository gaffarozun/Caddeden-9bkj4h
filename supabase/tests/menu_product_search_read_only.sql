-- Read-only regression; never create, change or remove user records.
do $$
declare result jsonb; row_data jsonb; last_price numeric := -1; previous_id uuid; count_rows integer := 0; candidate record;
begin
 if public.discovery_search_text('DÖNER') <> 'doner' or public.discovery_search_text('SAÇ ı İ') <> 'sac i i' then raise exception 'Turkish normalization mismatch'; end if;
 if public.public_menu_search('','yeme_icme','all',null,0,40) <> '{"items":[],"total":0}'::jsonb then raise exception 'Empty query must not enumerate menus'; end if;
 if public.public_menu_search('döner','invalid','all',null,0,40) <> '{"items":[],"total":0}'::jsonb then raise exception 'Invalid main category leaked rows'; end if;
 if public.public_menu_search('döner','yeme_icme','all',array[]::uuid[],0,40) <> '{"items":[],"total":0}'::jsonb then raise exception 'Empty open filter leaked rows'; end if;
 for candidate in select m.name from public.menu_items m join public.businesses b on b.id=m.business_id where b.approval_status='approved' and b.is_published and b.allow_menu and b.category in ('restoran','kafe','market','eglence','bar','club') and btrim(m.name)<>'' limit 5 loop
  result := public.public_menu_search(candidate.name,'yeme_icme','all',null,0,40);
  last_price := -1; previous_id := null; count_rows := 0;
  for row_data in select value from jsonb_array_elements(result->'items') loop
   if not exists(select 1 from public.businesses b join public.menu_items m on m.business_id=b.id where b.id=(row_data->>'business_id')::uuid and m.id=(row_data->>'item_id')::uuid and b.approval_status='approved' and b.is_published and b.allow_menu and m.name=row_data->>'name' and m.price=(row_data->>'price')::numeric) then raise exception 'Hidden or inaccurate menu exposed'; end if;
   if (row_data->>'price')::numeric < last_price then raise exception 'Price ascending order failed'; end if;
   if (row_data->>'price')::numeric=last_price and previous_id is not null and (row_data->>'item_id')::uuid<previous_id then raise exception 'Stable price tie order failed'; end if;
   if row_data ? 'owner_id' or row_data ? 'user_id' or row_data ? 'email' then raise exception 'Private account fields exposed'; end if;
   last_price := (row_data->>'price')::numeric; previous_id := (row_data->>'item_id')::uuid; count_rows := count_rows+1;
  end loop;
  if count_rows>40 then raise exception 'Pagination limit exceeded'; end if;
  if result->>'total' <> public.public_menu_search(candidate.name,'yeme_icme','all',null,1,40)->>'total' then raise exception 'Pagination total mismatch'; end if;
 end loop;
 if not has_function_privilege('anon','public.public_menu_search(text,text,text,uuid[],integer,integer)','execute') then raise exception 'Public search unavailable'; end if;
 if not (select bool_and(relrowsecurity) from pg_class where oid in ('public.businesses'::regclass,'public.menu_items'::regclass)) then raise exception 'Existing RLS missing'; end if;
end; $$;
begin;
set local role anon;
select public.public_menu_search('döner','yeme_icme','all',null,0,40);
rollback;
select 'passed: Turkish matching, visibility, exact prices, sorting, stable ties, pagination, open filter and public access' as result;

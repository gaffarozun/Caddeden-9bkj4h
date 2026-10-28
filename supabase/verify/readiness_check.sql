-- Caddeden: HEDEF Supabase projesinin (caddeden) uygulamaya hazır olup olmadığını denetler.
-- Salt okunurdur: hiçbir şeyi değiştirmez, gizli değer yazdırmaz.
-- Supabase panelinde SQL Editor'a yapıştırıp çalıştırın. Her satır: kontrol | durum | ayrıntı
--   OK    = beklenen nesne/ayar var
--   FAIL  = uygulama bu eksikle çalışmaz veya güvenlik açığı oluşur -> düzeltmeden yayına çıkmayın
--   WARN  = elle gözden geçirin
--   INFO  = bilgi
--
-- Beklenen listeler kaynak koddan (supabase.from / rpc / storage çağrıları) ve migration
-- dosyalarından çıkarılmıştır. Kod değişirse listeleri güncelleyin.

with
expected_tables(name) as (values
  ('user_profiles'),('businesses'),('menu_items'),('business_posts'),('orders'),('reservations'),
  ('ads'),('ad_packages'),('campaigns'),('payments'),('notifications'),('notification_requests'),
  ('complaints'),('account_deletion_requests'),('admin_logs'),('admin_alerts'),('app_config'),
  ('business_reviews'),('business_suggestions'),('suggestion_supports'),('feedback_rate_limits'),('business_star_ratings'),('business_account_approvals'),('account_type_decisions'),
  ('university_messages'),('order_messages'),('order_rating_receipts'),('customer_inbox'),('customer_inbox_reads'),
  ('experience_feature_settings'),('media_cleanup_queue'),('venue_profile_preferences'),
  ('cafe_rooms'),('cafe_tables'),('cafe_visits'),('cafe_social_profiles'),('cafe_instagram_requests'),('cafe_profile_photos')
),
expected_functions(name) as (values
  ('account_role'),('account_active'),('account_admin'),('account_customer'),('account_can_manage'),
  ('account_media_owner'),('account_business_access'),('handle_new_user'),('protect_user_profile_cols'),
  ('business_is_open'),('business_account_state'),('admin_set_account_type'),('admin_set_business_account_approval'),
  ('admin_campaign_decision'),('admin_order_report'),('business_order_report'),('creative_is_referenced'),
  ('customer_inbox_items'),('customer_inbox_read'),('pending_order_ratings'),('submit_order_business_rating'),
  ('submit_business_star'),('business_star_state'),('business_star_stats'),
  ('submit_paid_campaign'),('public_paid_campaigns'),('public_cadde_tv_channels'),('public_complaint_email'),('public_menu_search'),
  ('submit_university_message'),('university_public_messages'),('withdraw_university_message'),('moderate_university_message'),
  ('set_experience_feature'),('venue_profile_preference'),('set_venue_profile_preference'),
  ('feedback_read'),('feedback_write'),('feedback_admin_read'),('feedback_ratings'),('feedback_actor'),('feedback_admin_allowed'),
  ('feedback_begin_account_deletion'),('feedback_delete_account_data'),('feedback_throttle'),
  ('protect_business_cols'),('protect_ad_insert'),('protect_post_write'),('protect_notification_request_insert'),
  ('admin_alert_on_insert'),('set_updated_at'),('base_request_insert_guard'),('base_request_update_guard'),('protect_admin_role'),
  ('cafe_my_visit'),('cafe_room_state'),('cafe_set_room'),('cafe_set_visibility'),('cafe_leave'),('cafe_refresh_location'),
  ('cafe_nearby'),('cafe_join'),('cafe_save_photo'),('cafe_save_seating_payload'),('cafe_social_state'),('cafe_set_instagram'),
  ('cafe_request_instagram'),('cafe_decide_instagram'),('cafe_revoke_instagram'),('cafe_instagram_link')
),
expected_buckets(id, must_be_public) as (values
  ('business-media', true), ('feedback-evidence', false), ('cafe-profile-photos', false)
),
secret_tables(name) as (values ('app_config'),('admin_logs'),('payments'),('account_deletion_requests'),('account_type_decisions'),('business_account_approvals'))
select * from (

  select 1 as s, 'tablo: ' || t.name as kontrol,
         case when c.oid is null then 'FAIL' else 'OK' end as durum,
         case when c.oid is null then 'public.' || t.name || ' yok' else '' end as ayrinti
  from expected_tables t
  left join pg_class c on c.relname = t.name and c.relkind = 'r' and c.relnamespace = 'public'::regnamespace

  union all
  select 2, 'RLS: ' || t.name,
         case when c.relrowsecurity then 'OK' else 'FAIL' end,
         case when c.relrowsecurity then '' else 'RLS kapalı: anon/authenticated anahtarıyla herkes okuyup yazabilir' end
  from expected_tables t join pg_class c on c.relname = t.name and c.relkind = 'r' and c.relnamespace = 'public'::regnamespace

  union all
  select 3, 'fonksiyon: ' || f.name,
         case when exists (select 1 from pg_proc p where p.proname = f.name and p.pronamespace = 'public'::regnamespace) then 'OK' else 'FAIL' end,
         ''
  from expected_functions f

  union all
  select 4, 'fonksiyon yetkisi: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'WARN', 'PUBLIC/anon çalıştırabilir; SECURITY DEFINER olduğu için gerekliyse bilinçli olmalı'
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and p.proname in (select name from expected_functions)
    and p.proname not in ('public_paid_campaigns','public_cadde_tv_channels','public_complaint_email','public_menu_search','university_public_messages')
    and has_function_privilege('anon', p.oid, 'EXECUTE')

  union all
  select 5, 'bucket: ' || b.id,
         case when sb.id is null then 'FAIL'
              when sb.public is distinct from b.must_be_public then 'FAIL' else 'OK' end,
         case when sb.id is null then 'bucket yok'
              when sb.public is distinct from b.must_be_public
                then 'public=' || sb.public || ' ama beklenen ' || b.must_be_public else '' end
  from expected_buckets b left join storage.buckets sb on sb.id = b.id

  union all
  select 6, 'bucket politikaları: ' || b.id,
         case when n = 0 then 'FAIL' else 'OK' end,
         n || ' politika (storage.objects)'
  from expected_buckets b
  cross join lateral (select count(*) n from pg_policies p
                      where p.schemaname = 'storage' and p.tablename = 'objects'
                        and (p.qual ilike '%' || b.id || '%' or p.with_check ilike '%' || b.id || '%')) x

  union all
  select 7, 'auth tetikleyicisi: yeni kullanıcı -> user_profiles',
         case when exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                           where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal and p.proname = 'handle_new_user') then 'OK' else 'FAIL' end,
         'auth.users üzerinde handle_new_user tetikleyicisi yoksa kayıt olan kullanıcının profili oluşmaz'

  union all
  select 8, 'gizli tablo anon/authenticated okumasına açık mı: ' || st.name,
         case when exists (select 1 from pg_policies p
                           where p.schemaname = 'public' and p.tablename = st.name and p.cmd in ('SELECT','ALL')
                             and (p.roles && array['anon','public','authenticated']::name[])
                             and coalesce(p.qual, 'true') in ('true','(true)')) then 'FAIL' else 'OK' end,
         'app_config içinde admin_bootstrap_code bulunabilir; herkese açık SELECT politikası olmamalı'
  from secret_tables st
  where exists (select 1 from pg_class c where c.relname = st.name and c.relnamespace = 'public'::regnamespace)

  union all
  select 9, 'koşulsuz (true) politika: ' || p.tablename || '.' || p.policyname,
         'WARN', p.cmd || ' / roller: ' || array_to_string(p.roles, ',')
  from pg_policies p
  where p.schemaname in ('public','storage')
    and p.permissive = 'PERMISSIVE'
    and p.cmd <> 'SELECT'
    and ((p.cmd = 'INSERT' and coalesce(p.with_check, 'x') in ('true','(true)'))
      or (p.cmd in ('UPDATE','DELETE') and coalesce(p.qual, 'x') in ('true','(true)'))
      or (p.cmd = 'ALL' and coalesce(p.qual, p.with_check, 'x') in ('true','(true)')))

  union all
  select 10, 'korumalı tetikleyici: ' || x.tbl || ' -> ' || x.fn,
         case when exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                           where t.tgrelid = to_regclass('public.' || x.tbl) and not t.tgisinternal and p.proname = x.fn) then 'OK' else 'FAIL' end,
         'yoksa istemci fiyat/durum/onay alanlarını kendisi yazabilir'
  from (values ('user_profiles','protect_user_profile_cols'),('businesses','protect_business_cols'),('ads','protect_ad_insert'),
               ('business_posts','protect_post_write'),('notification_requests','protect_notification_request_insert'),
               ('orders','base_request_insert_guard'),('orders','base_request_update_guard'),
               ('reservations','base_request_insert_guard'),('reservations','base_request_update_guard'),
               ('user_profiles','protect_admin_role')) x(tbl, fn)
  where to_regclass('public.' || x.tbl) is not null

  union all
  select 10, 'hassas sütun yetkisi: user_profiles.' || c.col || ' (authenticated/anon UPDATE)',
         case when has_column_privilege('authenticated', 'public.user_profiles', c.col, 'UPDATE')
                or has_column_privilege('anon', 'public.user_profiles', c.col, 'UPDATE') then 'FAIL' else 'OK' end,
         'kullanıcı kendi rolünü/durumunu/e-postasını değiştirememeli'
  from (values ('role'),('status'),('restricted_until'),('email'),('id')) c(col)
  where to_regclass('public.user_profiles') is not null

  union all
  select 10, 'anon tablo yetkisi: ' || st.name,
         case when not has_table_privilege('anon', 'public.' || st.name, 'SELECT,INSERT,UPDATE,DELETE') then 'OK'
              when exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=st.name and (p.roles && array['anon','public']::name[])) then 'FAIL'
              else 'WARN' end,
         'anon tablo yetkisi var; politika yoksa RLS engeller (Supabase varsayılan yetkisi) ama yetkiyi geri almak daha güvenli: revoke all on public.<tablo> from anon'
  from secret_tables st
  where to_regclass('public.' || st.name) is not null

  union all
  select 10, 'başka işletme verisi: businesses UPDATE politikası sahiplik kontrolü',
         case when exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename='businesses' and p.cmd in ('UPDATE','ALL')
                           and coalesce(p.qual,'') ilike '%owner_id%') then 'OK' else 'WARN' end,
         'işletme yalnızca kendi satırını güncellemeli (owner_id = auth.uid())'
  where to_regclass('public.businesses') is not null

  union all
  select 10, 'işletme silinemez: authenticated DELETE yetkisi (businesses)',
         case when has_table_privilege('authenticated', 'public.businesses', 'DELETE') then 'FAIL' else 'OK' end,
         'işletme sahibi işletmeyi (ve siparişlerini) silememeli'
  where to_regclass('public.businesses') is not null

  union all
  select 10, 'işlem kaydı korunur: ' || x.tbl || '.business_id ON DELETE RESTRICT',
         case when exists (select 1 from pg_constraint c
                           where c.conrelid = to_regclass('public.' || x.tbl) and c.contype = 'f'
                             and c.confrelid = to_regclass('public.businesses') and c.confdeltype = 'r') then 'OK' else 'FAIL' end,
         'CASCADE olursa işletme silinince siparişler/rezervasyonlar da silinir'
  from (values ('orders'),('reservations')) x(tbl)
  where to_regclass('public.' || x.tbl) is not null and to_regclass('public.businesses') is not null

  union all
  select 10, 'tek yönetici dizini (user_profiles_single_admin)',
         case when exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'user_profiles_single_admin') then 'OK' else 'FAIL' end,
         'birden fazla admin satırı engellenir'
  where to_regclass('public.user_profiles') is not null

  union all
  select 10, 'müşteri doğrudan INSERT/UPDATE: orders toplam/ürün sütunu yetkisi',
         case when has_column_privilege('authenticated', 'public.orders', 'total', 'UPDATE')
                or has_column_privilege('authenticated', 'public.orders', 'items', 'UPDATE') then 'FAIL' else 'OK' end,
         'toplam ve ürünler yalnızca INSERT sırasında sunucu tetikleyicisiyle belirlenir'
  where to_regclass('public.orders') is not null

  union all
  select 11, 'yönetici hesabı',
         case when n = 0 then 'WARN' else 'OK' end,
         n || ' admin profili (admin-setup ekranı / admin_bootstrap_code ile oluşturulur)'
  from (select case when to_regclass('public.user_profiles') is null then 0
                    else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.user_profiles where role = ''admin''', false, true, '')))[1]::text::int
               end as n) x
  where to_regclass('public.user_profiles') is not null

  union all
  select 12, 'app_config anahtarları (değerler gösterilmez)', 'INFO',
         coalesce((xpath('/row/k/text()', query_to_xml('select coalesce(string_agg(key, '', '' order by key), ''(boş)'') as k from public.app_config', false, true, '')))[1]::text, '')
  where to_regclass('public.app_config') is not null

  union all
  select 13, 'Realtime yayını', 'INFO',
         coalesce((select string_agg(tablename, ', ' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'), '(yayında tablo yok; uygulama şu an polling kullanır, Realtime gerekmez)')

) r
order by s, case durum when 'FAIL' then 0 when 'WARN' then 1 when 'OK' then 2 else 3 end, kontrol;

-- Caddeden · 20261027 — fonksiyon yetkisi sertleştirme (SECURITY DEFINER / anon / PUBLIC denetimi sonucu).
-- Yalnızca EXECUTE yetkisini daraltır; tablo, veri, politika ve fonksiyon gövdesi değişmez. Tekrar çalıştırmak güvenlidir.
-- Dayanak (kodda tek tek doğrulandı):
--  * Tetikleyici fonksiyonları PostgREST ile çağrılamaz ve tetikleyici çalışırken çağıranın EXECUTE yetkisi gerekmez
--    (yetki yalnızca CREATE TRIGGER sırasında denenir). Bu yüzden hiçbir istemci rolüne açık olmamalı.
--  * account_type_pending(uuid) herhangi bir kullanıcı kimliği için "hesap türü kararı bekliyor" bilgisini döndürür.
--    Yalnızca başka SECURITY DEFINER fonksiyonlar (feedback_actor, business_star_state, submit_business_star, hesap yardımcıları) çağırır.
--  * account_* / feedback_admin_allowed yalnızca auth.uid() sahibini sorgular ve yalnızca RLS politikalarında (authenticated) ile
--    giriş yapmış kullanıcı akışlarında kullanılır; anon için hiçbir politika bunları çağırmaz.
-- Bilerek anon'a AÇIK bırakılanlar (uygulama giriş yapmadan çağırır): public_paid_campaigns, public_cadde_tv_channels,
-- public_complaint_email, public_menu_search, university_public_messages, feedback_read, feedback_ratings, business_star_state,
-- business_star_stats, experiences_enabled, cafe_room_state, discovery_search_text.
begin;
do $harden$
declare r record; n integer:=0;
begin
 for r in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as args from pg_proc p
          where p.pronamespace='public'::regnamespace and p.prokind='f' and p.prorettype='trigger'::regtype
            and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') loop
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',r.proname,r.args); n:=n+1;
 end loop;
 raise notice 'Tetikleyici fonksiyonlarından istemci EXECUTE yetkisi kaldırıldı: %',n;
 if to_regprocedure('public.account_type_pending(uuid)') is not null then
  revoke all on function public.account_type_pending(uuid) from public,anon,authenticated;
  grant execute on function public.account_type_pending(uuid) to service_role;
 end if;
 for r in select unnest(array['public.account_active()','public.account_admin()','public.account_can_manage(uuid)','public.account_customer()',
                              'public.account_media_owner(text)','public.account_role()','public.feedback_admin_allowed()']) as sig loop
  if to_regprocedure(r.sig) is not null then
   execute format('revoke all on function %s from public,anon',r.sig);
   execute format('grant execute on function %s to authenticated,service_role',r.sig);
  end if;
 end loop;

 -- Supabase varsayılan yetkileri yeni tablolarda anon'a da ALL verir; RLS engeller ama yetkiyi kökten kaldırmak daha güvenli.
 -- Yalnızca anon için hiçbir okuma/yazma politikası bulunmayan gizli/yönetici tabloları.
 for r in select t from unnest(array['app_config','admin_logs','admin_alerts','payments','account_deletion_requests','account_type_decisions',
                                      'business_account_approvals','feedback_rate_limits','media_cleanup_queue','experience_feature_settings']) t loop
  if to_regclass('public.'||r.t) is not null then execute format('revoke all on public.%I from anon',r.t); end if;
 end loop;
end;
$harden$;
commit;

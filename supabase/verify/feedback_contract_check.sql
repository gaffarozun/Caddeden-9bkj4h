-- Caddeden: 20261020_independent_stars.sql "Unexpected feedback_write entry contract" hatası için SALT OKUNUR tanı.
-- Hiçbir şeyi değiştirmez, işlev gövdesini veya veriyi yazdırmaz (yalnızca sayılar ve evet/hayır).
-- Önce açık kalmış başarısız işlemi temizlemek için ayrı bir sorgu olarak `rollback;` çalıştırın.
select * from (
 select 1 as s, f.name as kontrol,
        case when p.oid is null then 'YOK'
             when position(chr(13) in pg_get_functiondef(p.oid))>0 then 'CR VAR (CRLF) -> 20261002_normalize_function_sources.sql çalıştırın'
             when f.name in ('feedback_write(text,jsonb)','feedback_read(uuid,text,integer)') and strpos(pg_get_functiondef(p.oid),E'begin\n')=0 and strpos(pg_get_functiondef(p.oid),'-- experience_feature_gate')=0 then 'BEKLENMEYEN GÖVDE (begin+LF yok) -> üzerine yazmayın, bildirin'
             else 'uygun' end as durum,
        case when p.oid is null then '' else 'uzunluk=' || length(pg_get_functiondef(p.oid)) || ' begin+LF=' || ((length(pg_get_functiondef(p.oid)) - length(replace(pg_get_functiondef(p.oid),E'begin\n','')))/6) ||
             ' CR=' || (length(pg_get_functiondef(p.oid)) - length(replace(pg_get_functiondef(p.oid),chr(13),''))) end as ayrinti
 from (values ('feedback_write(text,jsonb)'),('feedback_read(uuid,text,integer)'),('feedback_ratings(uuid[])'),('feedback_actor(boolean)')) f(name)
 left join lateral (select to_regprocedure('public.' || f.name)::oid as oid) p on true
 union all
 select 2, 'independent_stars kısmen uygulanmış mı: ' || o.name,
        case when o.exists_ then 'VAR' else 'yok' end,
        case when o.exists_ then 'dosya tek işlemdir; yine de kalıntı varsa dosyayı yeniden çalıştırmak güvenlidir (idempotent)' else '' end
 from (values ('experience_feature_settings', to_regclass('public.experience_feature_settings') is not null),
              ('business_star_ratings', to_regclass('public.business_star_ratings') is not null),
              ('experiences_enabled()', to_regprocedure('public.experiences_enabled()') is not null),
              ('feedback_write kapısı (-- experience_feature_gate)', coalesce(strpos(pg_get_functiondef(to_regprocedure('public.feedback_write(text,jsonb)')),'-- experience_feature_gate')>0,false))) o(name, exists_)
) r order by s, kontrol;

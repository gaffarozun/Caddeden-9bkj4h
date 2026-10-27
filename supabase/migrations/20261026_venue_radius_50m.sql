-- Widen confirmed venue entry/exit to 50 m and remove the GPS accuracy ceiling.
-- Function definitions only: preserve existing visits, privacy, consent, RLS and heartbeat locking.
begin;
do $$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.cafe_join(uuid,double precision,double precision,double precision,timestamptz,boolean)',
  'public.cafe_nearby(double precision,double precision,double precision,timestamptz)',
  'public.cafe_refresh_location(uuid,double precision,double precision,double precision,timestamptz)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'or p_accuracy is null ','');
  definition:=replace(definition,'not(p_accuracy between 0 and 20)','(p_accuracy is not null and (p_accuracy<0 or p_accuracy::text in (''NaN'',''Infinity'',''-Infinity'')))');
  definition:=replace(definition,'x.distance_meters<40','x.distance_meters<50');
  definition:=replace(definition,'v_distance>=40','v_distance>=50');
  definition:=replace(definition,'v_distance>40','v_distance>=50');
  definition:=replace(definition,'40 metreden yakın','50 metreden yakın');
  definition:=replace(definition,'Güncel ve hassas konum gerekli (en fazla 20 m hassasiyet).','Güncel konum gerekli.');
  definition:=replace(definition,'Güncel ve hassas konum gerekli (en fazla 20 m).','Güncel konum gerekli.');
  definition:=replace(definition,'Güncel ve hassas konum gerekli.','Güncel konum gerekli.');
  if position('between 0 and 20' in definition)>0 or position('en fazla 20' in definition)>0 then raise exception 'Old accuracy ceiling remains'; end if;
  execute definition;
 end loop;
end; $$;
commit;
notify pgrst,'reload schema';

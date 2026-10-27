-- Extend owner-opt-in presence, profiles and seating to every business category.
-- Function definitions only: no business preferences, visits, plans or user data are changed.
begin;
do $$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.cafe_room_live(uuid)',
  'public.cafe_venue_live(uuid)',
  'public.cafe_set_room(uuid,boolean)',
  'public.cafe_save_seating(uuid,boolean,jsonb)',
  'public.cafe_room_state(uuid)',
  'public.cafe_nearby(double precision,double precision,double precision,timestamptz)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  -- Remove only the category predicate; keep owner, publication, opt-in and GPS guards.
  definition:=replace(definition,'and b.category=''kafe''','');
  definition:=replace(definition,'and category=''kafe''','');
  definition:=replace(definition,'Önce kafe kategorisini ve işletme konumunu kaydedin.','Önce işletme konumunu kaydedin.');
  definition:=replace(definition,'Masa planı yalnızca kafeler içindir.','İşletme bulunamadı.');
  definition:=replace(definition,'Başka kafenin masasını düzenleyemezsiniz.','Başka işletmenin masasını düzenleyemezsiniz.');
  execute definition;
 end loop;
 -- Existing Instagram authorization logic is unchanged; only user-facing wording is generalized.
 foreach signature in array array[
  'public.cafe_set_visibility(boolean)',
  'public.cafe_request_instagram(uuid)',
  'public.cafe_decide_instagram(uuid,boolean)',
  'public.cafe_instagram_link(uuid)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'Kafeye yeniden katılın.','Mekâna yeniden katılın.');
  definition:=replace(definition,'aynı kafede','aynı mekânda');
  execute definition;
 end loop;
end; $$;
commit;
notify pgrst,'reload schema';

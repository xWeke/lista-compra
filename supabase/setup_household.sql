-- =============================================================================
-- PLANTILLA de alta del hogar. No pongas aquí datos reales: este fichero está en el repo (público).
-- Cópialo como `setup_household.local.sql` (ignorado por git), rellena emails y nombres en la copia
-- y ejecuta la copia en Supabase → SQL Editor, tras aplicar las migraciones.
--
-- Requisitos: los usuarios de la lista ya creados en Authentication → Users.
-- Es idempotente: si ya existe un hogar con ese nombre, lo reutiliza; se puede volver a ejecutar
-- para añadir miembros (p. ej. la pareja más adelante) sin tocar listas ni productos existentes.
--
-- Para añadir a tu pareja: crea su usuario en Authentication → Users (con "Auto confirm user"),
-- añade su línea dentro de los corchetes de `members` (hay una de ejemplo comentada justo debajo) y ejecútalo otra vez.
-- =============================================================================
do $$
declare
  hh_name   constant text := 'Casa';
  members   constant jsonb := '[
    {"email": "tu-email@ejemplo.com", "name": "Tu nombre", "role": "owner"}
  ]';
  -- Pareja (más adelante), añadir dentro de los corchetes de arriba, separada por una coma:
  --  ,{"email": "email-de-tu-pareja@ejemplo.com", "name": "Nombre", "role": "member"}
  hh        uuid;
  m         jsonb;
  uid       uuid;
begin
  select id into hh from public.households where name = hh_name limit 1;
  if hh is null then
    insert into public.households (name) values (hh_name) returning id into hh;
  end if;

  for m in select * from jsonb_array_elements(members) loop
    select id into uid from auth.users where lower(email) = lower(m ->> 'email');
    if uid is null then
      raise exception 'No existe el usuario %. Créalo antes en Authentication → Users.', m ->> 'email';
    end if;

    insert into public.household_members (household_id, user_id, role)
    values (hh, uid, m ->> 'role')
    on conflict (household_id, user_id) do update set role = excluded.role;

    insert into public.profiles (id, display_name)
    values (uid, m ->> 'name')
    on conflict (id) do update set display_name = excluded.display_name;
  end loop;

  perform public.seed_household_defaults(hh);
  raise notice 'Hogar % listo (id %)', hh_name, hh;
end;
$$;

-- =============================================================================
-- Lista_Compra — esquema inicial (Fase 1)
--
-- Modelo:
--   households ─┬─ household_members ── auth.users ── profiles
--               ├─ lists ── list_items ──┐
--               ├─ categories            │
--               └─ products ─────────────┘   (catálogo: aquí se colgarán los precios en Fase 2)
--
-- Seguridad: RLS en todas las tablas. Regla única: "solo ves/modificas filas
-- de los hogares de los que eres miembro".
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Normaliza nombres para búsquedas y unicidad: "  Plátano " -> "platano".
-- unaccent no es IMMUTABLE por defecto; la forma con diccionario explícito sí
-- se puede envolver como IMMUTABLE (necesario para columnas generadas e índices).
create or replace function public.normalize_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(value)));
$$;

-- Trigger genérico: mantiene updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Usuarios y hogares
-- -----------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);
comment on table public.profiles is 'Datos visibles de cada usuario (nombre). 1:1 con auth.users.';

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
comment on table public.households is 'Grupo que comparte listas, categorías y catálogo. Unidad de compartición para RLS.';

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members (user_id);

-- ¿Es el usuario actual miembro del hogar? Base de todas las políticas.
-- SECURITY DEFINER para que la consulta interna no vuelva a pasar por RLS
-- (evita recursión infinita en las políticas de household_members).
create or replace function public.is_household_member(hh uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = (select auth.uid())
  );
$$;

-- Crea el perfil automáticamente al crear un usuario en Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios que ya existieran antes de esta migración.
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Listas, categorías, productos e ítems
-- -----------------------------------------------------------------------------

create table public.lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index lists_household_id_idx on public.lists (household_id);
create trigger lists_set_updated_at before update on public.lists
  for each row execute function public.set_updated_at();

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  icon         text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, name)
);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  name                text not null check (length(btrim(name)) > 0),
  name_normalized     text generated always as (public.normalize_name(name)) stored,
  default_category_id uuid references public.categories (id) on delete set null,
  default_unit        text not null default 'ud' check (default_unit in ('ud', 'kg', 'g', 'l', 'ml', 'pack')),
  barcode             text, -- EAN. Fase 3: casar el producto con el catálogo de cada súper.
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (household_id, name_normalized)
);
comment on table public.products is 'Catálogo del hogar ("qué es"). Los precios por supermercado (Fase 2) cuelgan de aquí.';
create index products_default_category_id_idx on public.products (default_category_id);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null, -- null = usar la del producto
  quantity    numeric(10, 3) not null default 1 check (quantity > 0),
  unit        text not null default 'ud' check (unit in ('ud', 'kg', 'g', 'l', 'ml', 'pack')),
  note        text,
  is_checked  boolean not null default false,
  checked_at  timestamptz,
  checked_by  uuid references auth.users (id) on delete set null,
  archived_at timestamptz, -- "Limpiar comprados" lo rellena; null = visible en la lista
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.list_items is 'Lo que hay que comprar en una lista concreta ("cuánto y si ya está"). Archivados = historial de compras.';
create index list_items_list_id_idx on public.list_items (list_id, is_checked) where archived_at is null;
create index list_items_product_id_idx on public.list_items (product_id);
create index list_items_category_id_idx on public.list_items (category_id);
create trigger list_items_set_updated_at before update on public.list_items
  for each row execute function public.set_updated_at();

-- Rellena checked_at / checked_by en el servidor (no nos fiamos del cliente).
create or replace function public.list_items_track_checked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_checked and (tg_op = 'INSERT' or not old.is_checked) then
    new.checked_at = now();
    new.checked_by = auth.uid();
  elsif not new.is_checked then
    new.checked_at = null;
    new.checked_by = null;
  end if;
  return new;
end;
$$;

create trigger list_items_track_checked before insert or update of is_checked on public.list_items
  for each row execute function public.list_items_track_checked();

-- Un ítem solo puede apuntar a producto/categoría del mismo hogar que su lista.
create or replace function public.list_items_check_household()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  list_hh uuid;
begin
  select household_id into list_hh from public.lists where id = new.list_id;
  if not exists (select 1 from public.products p where p.id = new.product_id and p.household_id = list_hh) then
    raise exception 'El producto no pertenece al hogar de la lista';
  end if;
  if new.category_id is not null
     and not exists (select 1 from public.categories c where c.id = new.category_id and c.household_id = list_hh) then
    raise exception 'La categoría no pertenece al hogar de la lista';
  end if;
  return new;
end;
$$;

create trigger list_items_check_household before insert or update of list_id, product_id, category_id on public.list_items
  for each row execute function public.list_items_check_household();

-- Resumen para la pantalla "Mis listas": nº de pendientes y comprados.
-- security_invoker = la vista respeta el RLS del usuario que consulta.
create view public.list_summaries
with (security_invoker = true)
as
select
  l.*,
  count(i.id) filter (where not i.is_checked) as pending_count,
  count(i.id) filter (where i.is_checked)     as checked_count
from public.lists l
left join public.list_items i on i.list_id = l.id and i.archived_at is null
group by l.id;

-- -----------------------------------------------------------------------------
-- Datos iniciales por hogar
-- -----------------------------------------------------------------------------

create or replace function public.seed_household_defaults(hh uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (household_id, name, icon, sort_order)
  values
    (hh, 'Fruta y verdura', '🥦', 10),
    (hh, 'Panadería',       '🥖', 20),
    (hh, 'Carne',           '🥩', 30),
    (hh, 'Pescado',         '🐟', 40),
    (hh, 'Lácteos y huevos','🥛', 50),
    (hh, 'Despensa',        '🥫', 60),
    (hh, 'Congelados',      '🧊', 70),
    (hh, 'Bebidas',         '🥤', 80),
    (hh, 'Limpieza',        '🧽', 90),
    (hh, 'Higiene',         '🧴', 100),
    (hh, 'Otros',           '📦', 110)
  on conflict (household_id, name) do nothing;

  insert into public.lists (household_id, name, created_by)
  select hh, 'Compra semanal', null
  where not exists (select 1 from public.lists where household_id = hh);
$$;

-- Solo para administración (SQL Editor / service_role), nunca desde la app.
revoke execute on function public.seed_household_defaults(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------

-- Permisos explícitos: anon (sin sesión) no toca nada; authenticated pasa por RLS.
revoke all on all tables in schema public from anon;
grant select on public.profiles, public.households, public.household_members to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name) on public.households to authenticated;
grant select, insert, update, delete on public.lists, public.categories, public.products, public.list_items to authenticated;
grant select on public.list_summaries to authenticated;

-- Con "Automatically expose new tables" desactivado en el proyecto, nada queda accesible por defecto:
-- además de las tablas, se conceden explícitamente los esquemas y las funciones que usan las
-- políticas RLS (is_household_member) y la columna generada products.name_normalized (normalize_name → unaccent).
grant usage on schema public to authenticated;
grant usage on schema extensions to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.normalize_name(text) to authenticated;
grant execute on function extensions.unaccent(regdictionary, text) to authenticated;

alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.lists             enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.list_items        enable row level security;

-- profiles: me veo a mí y a quien comparte hogar conmigo; solo edito el mío.
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.household_members m
      where m.user_id = profiles.id and public.is_household_member(m.household_id)
    )
  );
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- households / members: solo lectura (y renombrar el hogar). Se crean por SQL.
create policy "households_select" on public.households for select to authenticated
  using (public.is_household_member(id));
create policy "households_update" on public.households for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));
create policy "household_members_select" on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

-- lists / categories / products: todo, si eres del hogar.
create policy "lists_all" on public.lists for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "categories_all" on public.categories for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "products_all" on public.products for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- list_items: a través del hogar de su lista.
create policy "list_items_all" on public.list_items for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and public.is_household_member(l.household_id)))
  with check (exists (select 1 from public.lists l where l.id = list_id and public.is_household_member(l.household_id)));

-- -----------------------------------------------------------------------------
-- Realtime: Postgres emite los cambios de estas tablas por websocket.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.lists, public.list_items, public.categories, public.products;

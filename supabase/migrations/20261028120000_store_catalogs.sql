-- Fase 3 (empezando por Mercadona): catálogo de cada súper volcado en la BD, historial de precios y
-- emparejamiento "producto vuestro" → "producto del súper" para calcular cuánto costaría la lista.
--
--   stores                 súpers (globales: son los mismos para todos los hogares)
--   store_products         catálogo bruto de cada súper; lo rellena la Edge Function sync-<súper> cada noche
--   store_product_prices   historial: una fila solo cuando cambia el precio (trigger)
--   product_store_links    "Leche entera" (vuestra) → "Leche entera Hacendado · Brik" (Mercadona)
--
-- Seguridad: el catálogo es público para cualquier usuario con sesión (solo lectura); solo la Edge Function
-- (service_role) escribe en él. Los emparejamientos son de cada hogar (RLS por el producto).

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Súpers
-- -----------------------------------------------------------------------------
create table public.stores (
  id                text primary key check (id ~ '^[a-z0-9_]+$'),
  name              text not null,
  sort_order        integer not null default 0,
  has_catalog       boolean not null default false, -- precios automáticos (catálogo volcado)
  catalog_synced_at timestamptz                     -- último volcado correcto
);

insert into public.stores (id, name, sort_order, has_catalog) values
  ('mercadona', 'Mercadona', 10, true),
  ('ahorramas', 'Ahorramas', 20, false),
  ('lidl',      'Lidl',      30, false),
  ('dia',       'Dia',       40, false),
  ('carrefour', 'Carrefour', 50, false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Catálogo de cada súper
-- -----------------------------------------------------------------------------
create table public.store_products (
  id               uuid primary key default gen_random_uuid(),
  store_id         text not null references public.stores (id) on delete cascade,
  external_id      text not null,                      -- id del producto en la web del súper
  name             text not null,
  name_normalized  text generated always as (public.normalize_name(name)) stored,
  packaging        text,                               -- "Brik", "Pack-6", "Pieza"…
  category         text,
  price            numeric(10, 2) not null check (price >= 0), -- precio del envase / pieza
  reference_price  numeric(10, 3),                     -- precio por reference_format (€/kg, €/L…)
  reference_format text,                               -- 'kg', 'L', 'ud', '100 ml'…
  unit_size        numeric(10, 3),                     -- contenido del envase (1.0)…
  size_format      text,                               -- …en esta unidad ('l', 'kg')
  is_pack          boolean not null default false,
  image_url        text,
  url              text,
  available        boolean not null default true,      -- false = ya no aparece en la web
  seen_at          timestamptz not null default now(), -- último volcado en el que apareció
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (store_id, external_id)
);
-- Búsqueda por parecido de nombre ("platanos" ≈ "platano de canarias igp")
create index store_products_name_trgm_idx on public.store_products using gin (name_normalized extensions.gin_trgm_ops);
create trigger store_products_set_updated_at before update on public.store_products
  for each row execute function public.set_updated_at();

-- Historial de precios: se apunta al crear el producto y cada vez que cambia el precio.
create table public.store_product_prices (
  store_product_id uuid not null references public.store_products (id) on delete cascade,
  observed_at      timestamptz not null default now(),
  price            numeric(10, 2) not null,
  reference_price  numeric(10, 3),
  primary key (store_product_id, observed_at)
);

create or replace function public.store_products_track_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.price is distinct from old.price
     or new.reference_price is distinct from old.reference_price then
    insert into public.store_product_prices (store_product_id, price, reference_price)
    values (new.id, new.price, new.reference_price);
  end if;
  return new;
end;
$$;

create trigger store_products_track_price after insert or update of price, reference_price on public.store_products
  for each row execute function public.store_products_track_price();

-- -----------------------------------------------------------------------------
-- Emparejamiento producto del hogar → producto del súper
-- -----------------------------------------------------------------------------
create table public.product_store_links (
  product_id       uuid not null references public.products (id) on delete cascade,
  store_id         text not null references public.stores (id) on delete cascade,
  store_product_id uuid references public.store_products (id) on delete cascade, -- null = "no lo compramos aquí"
  matched_by       text not null check (matched_by in ('auto', 'manual')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (product_id, store_id)
);
create index product_store_links_store_product_id_idx on public.product_store_links (store_product_id);
create trigger product_store_links_set_updated_at before update on public.product_store_links
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funciones
-- -----------------------------------------------------------------------------

-- Buscar en el catálogo de un súper (para "Cambiar" el producto emparejado). Más parecido primero.
create or replace function public.search_store_products(p_store text, p_query text, p_limit integer default 30)
returns setof public.store_products
language sql
stable
security invoker
set search_path = ''
as $$
  select sp.*
    from public.store_products sp
   where sp.store_id = p_store
     and sp.available
     and (extensions.word_similarity(public.normalize_name(p_query), sp.name_normalized) >= 0.45
          or sp.name_normalized like '%' || public.normalize_name(p_query) || '%')
   order by extensions.word_similarity(public.normalize_name(p_query), sp.name_normalized) desc,
            sp.reference_price nulls last, sp.price
   limit least(greatest(p_limit, 1), 100);
$$;

-- Empareja automáticamente los productos indicados que aún no tengan pareja en ese súper.
-- Regla: entre los candidatos más parecidos (hasta 0,1 por debajo del mejor, y como mínimo 0,5),
-- el más barato por kg/L y, a igualdad, el envase más barato (un brik antes que el pack de 6).
-- security invoker: solo ve (y empareja) productos de los hogares del usuario, por RLS.
create or replace function public.auto_link_products(p_store text, p_product_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.product_store_links (product_id, store_id, store_product_id, matched_by)
  select p.id, p_store, best.id, 'auto'
    from public.products p
    cross join lateral (
      select c.id
        from (
          select sp.id, sp.price, sp.reference_price, s.sim, max(s.sim) over () as best_sim
            from public.store_products sp
            cross join lateral (
              select extensions.word_similarity(p.name_normalized, sp.name_normalized) as sim
            ) s
           where sp.store_id = p_store and sp.available
        ) c
       where c.sim >= 0.5
         and c.sim >= c.best_sim - 0.1
       order by c.reference_price nulls last, c.price
       limit 1
    ) best
   where p.id = any (p_product_ids)
     and not exists (
       select 1 from public.product_store_links l where l.product_id = p.id and l.store_id = p_store
     )
  on conflict (product_id, store_id) do nothing;
$$;

-- Para la Edge Function de volcado: comprueba el secreto que manda pg_cron (guardado en Vault).
-- Solo la puede ejecutar service_role: ni la app ni usuarios anónimos pueden probar secretos.
create or replace function public.check_sync_secret(secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets where name = 'catalog_sync_secret' and decrypted_secret = secret
  );
$$;

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------
grant select on public.stores, public.store_products, public.store_product_prices to authenticated;
grant select, insert, update, delete on public.product_store_links to authenticated;

revoke execute on function public.check_sync_secret(text) from public, anon, authenticated;
grant execute on function public.check_sync_secret(text) to service_role;
revoke execute on function public.search_store_products(text, text, integer), public.auto_link_products(text, uuid[])
  from public, anon;
grant execute on function public.search_store_products(text, text, integer), public.auto_link_products(text, uuid[])
  to authenticated;

alter table public.stores               enable row level security;
alter table public.store_products       enable row level security;
alter table public.store_product_prices enable row level security;
alter table public.product_store_links  enable row level security;

-- Catálogo: lectura para cualquiera con sesión; escritura solo service_role (que se salta RLS).
create policy "stores_select" on public.stores for select to authenticated using (true);
create policy "store_products_select" on public.store_products for select to authenticated using (true);
create policy "store_product_prices_select" on public.store_product_prices for select to authenticated using (true);

-- Emparejamientos: los de productos de vuestro hogar.
create policy "product_store_links_all" on public.product_store_links for all to authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)
  ))
  with check (exists (
    select 1 from public.products p where p.id = product_id and public.is_household_member(p.household_id)
  ));

-- Tiempo real: si Andrea cambia un emparejamiento, se ve al momento.
alter publication supabase_realtime add table public.product_store_links;

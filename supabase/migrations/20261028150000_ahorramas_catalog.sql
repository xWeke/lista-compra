-- Ahorramas: catálogo automático (Edge Function sync-ahorramas).
-- Su web es lenta (hasta ~90 s por categoría grande) y una Edge Function tiene ~150 s, así que el volcado
-- va por partes (categorías): cada ejecución descarga las partes más antiguas y apunta aquí cuándo.

create table public.store_sync_parts (
  store_id   text not null references public.stores (id) on delete cascade,
  part       text not null,           -- ruta de la categoría, p. ej. '/lacteos/'
  synced_at  timestamptz,             -- último volcado correcto de esta parte
  products   integer,                 -- productos leídos en ese volcado
  error      text,                    -- último error (null si fue bien)
  primary key (store_id, part)
);

-- Solo la usa la Edge Function (service_role). Con RLS activado y sin políticas, la app no la ve.
alter table public.store_sync_parts enable row level security;
grant select, insert, update, delete on public.store_sync_parts to service_role;

update public.stores set has_catalog = true where id = 'ahorramas';

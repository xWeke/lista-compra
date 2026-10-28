-- Reordenar categorías y listas arrastrando: la app manda los ids en el orden nuevo y se guarda todo
-- en una sola transacción (si falla, no queda a medias). sort_order = posición × 10.
--
-- security invoker (lo normal): la función se ejecuta con los permisos de quien la llama, así que el RLS
-- de la tabla sigue mandando. Ids de otro hogar simplemente no se actualizan.

create or replace function public.reorder_categories(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.categories c
     set sort_order = o.pos * 10
    from unnest(ids) with ordinality as o(id, pos)
   where c.id = o.id
     and c.sort_order is distinct from o.pos * 10;
$$;

create or replace function public.reorder_lists(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.lists l
     set sort_order = o.pos * 10
    from unnest(ids) with ordinality as o(id, pos)
   where l.id = o.id
     and l.sort_order is distinct from o.pos * 10;
$$;

revoke execute on function public.reorder_categories(uuid[]), public.reorder_lists(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]), public.reorder_lists(uuid[]) to authenticated;

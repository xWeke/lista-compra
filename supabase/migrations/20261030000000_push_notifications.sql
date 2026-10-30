-- Avisos al móvil (Web Push): cuando uno añade productos o empieza a hacer la compra, al otro le llega un aviso.
--
-- Cómo funciona:
--   1. Triggers en list_items apuntan cada evento en push_events (cola).
--   2. pg_cron (supabase/setup_push.sql) mira la cola cada 30 s y, si hay algo listo, llama a la Edge Function
--      send-push, que recoge los grupos con claim_push_batches() y envía a los móviles de los demás miembros.
--   3. Los "añadidos" se agrupan: se espera a que la persona lleve 60 s sin añadir nada en esa lista (o 5 min
--      desde el primero), así 10 productos seguidos son un solo aviso.

-- Móviles/navegadores donde cada usuario ha activado los avisos. La app solo escribe con las funciones de abajo.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique, -- URL del servicio de avisos del navegador (Apple, Google, Mozilla…)
  p256dh     text not null,        -- clave pública del navegador para cifrar el aviso
  auth       text not null,
  created_at timestamptz not null default now()
);
comment on table public.push_subscriptions is 'Dispositivos con avisos activados (Web Push). Solo se escriben con save/delete_push_subscription.';
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- Sin políticas para authenticated: la app no lee ni escribe la tabla directamente.
grant select, delete on public.push_subscriptions to service_role;

-- Guarda este dispositivo para el usuario actual. Si el mismo navegador estaba a nombre de otro usuario
-- (cerró sesión y entró el otro), pasa a ser del actual.
create or replace function public.save_push_subscription(endpoint text, p256dh text, auth text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  select auth.uid(), save_push_subscription.endpoint, save_push_subscription.p256dh, save_push_subscription.auth
   where auth.uid() is not null
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
$$;

create or replace function public.delete_push_subscription(endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s
   where s.endpoint = delete_push_subscription.endpoint and s.user_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- Cola de eventos. 'added' cuelga del producto de la lista: si se borra antes de avisar, no se avisa de él.
create table public.push_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id      uuid not null references public.lists (id) on delete cascade,
  list_item_id uuid references public.list_items (id) on delete cascade,
  actor_id     uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('added', 'shopping')),
  item_name    text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
comment on table public.push_events is 'Cola de avisos pendientes (la rellenan triggers de list_items y la vacía la Edge Function send-push).';
create index push_events_pending_idx on public.push_events (list_id, actor_id) where sent_at is null;
create index push_events_household_id_idx on public.push_events (household_id);
create index push_events_list_item_id_idx on public.push_events (list_item_id);
create index push_events_actor_id_idx on public.push_events (actor_id);
alter table public.push_events enable row level security;
-- Sin políticas ni grants para authenticated: solo la escriben los triggers (security definer) y la lee service_role.

-- Producto añadido a una lista (no los que entran ya marcados ni sin autor conocido)
create or replace function public.push_on_item_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is null or new.is_checked or new.archived_at is not null then
    return new;
  end if;
  insert into public.push_events (household_id, list_id, list_item_id, actor_id, kind, item_name)
  select l.household_id, new.list_id, new.id, new.created_by, 'added', p.name
    from public.lists l, public.products p
   where l.id = new.list_id and p.id = new.product_id;
  return new;
end;
$$;

-- Primer producto marcado en una lista tras 2 h sin marcar nada en ella = alguien ha empezado la compra
create or replace function public.push_on_item_checked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.checked_by is null then
    return new;
  end if;
  if exists (
       select 1 from public.list_items i
        where i.list_id = new.list_id and i.id <> new.id
          and i.checked_at > now() - interval '2 hours'
     ) or exists (
       select 1 from public.push_events e
        where e.list_id = new.list_id and e.kind = 'shopping'
          and e.created_at > now() - interval '2 hours'
     ) then
    return new;
  end if;
  insert into public.push_events (household_id, list_id, actor_id, kind)
  select l.household_id, new.list_id, new.checked_by, 'shopping'
    from public.lists l
   where l.id = new.list_id;
  return new;
end;
$$;

revoke execute on function public.push_on_item_added() from public, anon, authenticated;
revoke execute on function public.push_on_item_checked() from public, anon, authenticated;

create trigger list_items_push_added after insert on public.list_items
  for each row execute function public.push_on_item_added();
create trigger list_items_push_checked after update of is_checked on public.list_items
  for each row when (new.is_checked and not old.is_checked)
  execute function public.push_on_item_checked();

-- ¿Hay algo listo para enviar? (lo usa pg_cron para no llamar a la Edge Function en balde)
create or replace function public.push_events_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.push_events e
     where e.sent_at is null
     group by e.list_id, e.actor_id, e.kind
    having e.kind = 'shopping'
        or max(e.created_at) < now() - interval '60 seconds'
        or min(e.created_at) < now() - interval '5 minutes'
  );
$$;

-- Recoge los grupos listos, los marca como enviados (en la misma transacción: dos ejecuciones a la vez no
-- avisan dos veces) y devuelve un aviso por grupo con a quién mandarlo. Limpia lo enviado hace > 7 días.
create or replace function public.claim_push_batches()
returns table (
  kind       text,
  list_id    uuid,
  list_name  text,
  actor_name text,
  item_names text[],
  recipients uuid[]
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  delete from public.push_events e where e.sent_at < now() - interval '7 days';

  return query
  with ready as (
    select e.list_id, e.actor_id, e.kind
      from public.push_events e
     where e.sent_at is null
     group by e.list_id, e.actor_id, e.kind
    having e.kind = 'shopping'
        or max(e.created_at) < now() - interval '60 seconds'
        or min(e.created_at) < now() - interval '5 minutes'
  ),
  claimed as (
    update public.push_events e
       set sent_at = now()
      from ready r
     where e.sent_at is null and e.list_id = r.list_id and e.actor_id = r.actor_id and e.kind = r.kind
    returning e.*
  )
  select c.kind,
         c.list_id,
         l.name,
         coalesce(p.display_name, 'Alguien'),
         array_agg(c.item_name order by c.created_at) filter (where c.item_name is not null),
         array(select m.user_id from public.household_members m
                where m.household_id = l.household_id and m.user_id <> c.actor_id)
    from claimed c
    join public.lists l on l.id = c.list_id
    left join public.profiles p on p.id = c.actor_id
   group by c.kind, c.list_id, c.actor_id, l.name, l.household_id, p.display_name;
end;
$$;

revoke execute on function public.push_events_ready() from public, anon, authenticated;
revoke execute on function public.claim_push_batches() from public, anon, authenticated;
grant execute on function public.claim_push_batches() to service_role;

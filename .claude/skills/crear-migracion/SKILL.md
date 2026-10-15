---
name: crear-migracion
description: Crea una migración SQL de Supabase para Lista_Compra (tablas, columnas, vistas, funciones, políticas RLS). Úsala siempre que haya que cambiar el esquema de la base de datos, p. ej. las tablas de precios de la Fase 2.
---

# Crear una migración de Supabase

## Pasos

1. Crear el fichero (nombre en snake_case, en inglés):
   ```bash
   npm run db:new -- add_store_prices
   ```
   Genera `supabase/migrations/<timestamp>_add_store_prices.sql`. **Nunca** edites una migración ya aplicada (`db push`); crea otra.

2. Escribir el SQL siguiendo la plantilla de abajo y las convenciones de `supabase/migrations/20261015000000_init.sql`.

3. Explicar al usuario qué hace la migración (es sysadmin: le interesan tablas, índices, RLS y riesgos sobre datos existentes).

4. Pedirle que la aplique, o aplicarla si lo autoriza:
   ```bash
   npm run db:push     # aplica en el proyecto remoto enlazado
   npm run db:types    # regenera src/types/database.ts
   ```
   Si el proyecto aún no está enlazado, actualiza `src/types/database.ts` a mano con el mismo formato que genera el CLI.

5. `npm run typecheck` para ver qué código rompe el cambio de tipos.

## Plantilla de tabla nueva

```sql
create table public.<tabla> (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- columnas...
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.<tabla> is '<para qué sirve>';

create index <tabla>_household_id_idx on public.<tabla> (household_id);
-- un índice por cada FK que se consulte

create trigger <tabla>_set_updated_at before update on public.<tabla>
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.<tabla> to authenticated;

alter table public.<tabla> enable row level security;
create policy "<tabla>_all" on public.<tabla> for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Solo si la app debe recibir cambios en tiempo real:
alter publication supabase_realtime add table public.<tabla>;
```

## Reglas

- **RLS siempre activado**. Tablas que cuelgan de otra (sin `household_id`) comprueban el hogar vía `exists (select 1 from public.<padre> p where p.id = <fk> and public.is_household_member(p.household_id))`.
- Tablas globales de solo lectura (p. ej. `stores`): `grant select` y política `using (true)`; escribir solo con service_role / SQL Editor.
- Funciones: `set search_path = ''` y nombres totalmente cualificados (`public.x`, `extensions.y`). `security definer` solo si es imprescindible, y revocar `execute` a `anon`/`authenticated` si es de administración.
- Vistas: `with (security_invoker = true)` para que respeten RLS.
- Dinero: `numeric(10,2)`. Cantidades: `numeric(10,3)`. Fechas: `timestamptz`.
- Valores enumerados con `check (col in (...))` (más fácil de ampliar que un `enum` de Postgres).
- Cambios destructivos (drop/rename de columnas con datos): avisar al usuario y proponer migración en dos pasos.
- Actualizar la sección "Modelo de datos" de `CLAUDE.md` si cambia el modelo.

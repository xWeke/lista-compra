---
name: anadir-feature-datos
description: Añade la capa de datos de un dominio en src/features/<dominio>/ (api.ts con consultas a Supabase + hooks.ts con TanStack Query y Realtime). Úsala cuando una página necesite leer o modificar una tabla nueva o existente.
---

# Añadir una feature de datos

Cada dominio vive en `src/features/<dominio>/` con dos ficheros. Referencias: `src/features/items/` (con optimistas) y `src/features/categories/` (simple).

## 1. `api.ts` — funciones async, sin React

```ts
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Store = Tables<'stores'>;

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('*').order('name');
  if (error) throw error;
  return data;
}
```

- Siempre `if (error) throw error;` (TanStack Query gestiona el error).
- Para joins usar el embed de PostgREST: `.select('*, product:products(id, name)')` y tipar el resultado.
- Traducir errores conocidos a mensajes en español (p. ej. `23505` = duplicado).

## 2. Query key en `src/lib/query-client.ts`

Añadir la clave a `queryKeys` (p. ej. `stores: ['stores'] as const`). No escribir arrays de keys sueltos.

## 3. `hooks.ts` — React

```ts
export function useStores() {
  return useQuery({ queryKey: queryKeys.stores, queryFn: fetchStores });
}
```

- **Tiempo real**: si los datos los puede cambiar el otro usuario, llamar a
  `useRealtimeInvalidation('<canal>', [{ table: '<tabla>', filter: 'household_id=eq.<id>' }], [<queryKey>], enabled)`.
  La tabla debe estar en la publicación `supabase_realtime` (ver skill `crear-migracion`) y en el tipo `RealtimeTable` de `src/lib/realtime.ts`.
- **Mutaciones**: agrupar en `use<Dominio>Mutations()` que devuelve `{ create, update, remove... }`; en `onSuccess`/`onSettled` invalidar las keys afectadas.
- Acciones frecuentes (tocar para marcar, sumar cantidad): **optimistas** con `onMutate` + rollback en `onError`, copiando el patrón `optimistic`/`rollback` de `features/items/hooks.ts`.
- Errores al usuario con `notifyError` de `@/lib/confirm`.

## Comprobar

`npm run typecheck && npm run lint`.

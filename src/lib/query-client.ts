// Caché de consultas (TanStack Query). Cada consulta se identifica por una "query key"
// (p. ej. ['items', listId]); Realtime y las mutaciones invalidan esas claves para refrescar.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // los datos llegan por Realtime: no hace falta refetch agresivo
      retry: 1,
    },
  },
});

export const queryKeys = {
  household: ['household'] as const,
  members: (householdId: string) => ['members', householdId] as const,
  lists: (householdId: string) => ['lists', householdId] as const,
  list: (listId: string) => ['list', listId] as const,
  items: (listId: string) => ['items', listId] as const,
  categories: (householdId: string) => ['categories', householdId] as const,
  products: (householdId: string) => ['products', householdId] as const,
  stores: ['stores'] as const,
  /** Emparejamientos de unos productos en un súper (la clave incluye los ids: cambian al añadir a la lista). */
  storeLinks: (storeId: string, productIds: string[]) => ['storeLinks', storeId, productIds] as const,
  storeSearch: (storeId: string, query: string) => ['storeSearch', storeId, query] as const,
};

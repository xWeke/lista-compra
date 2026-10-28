// Hooks de listas: consultas cacheadas + mutaciones + tiempo real.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyError } from '@/lib/confirm';

import { queryKeys } from '@/lib/query-client';
import { useRealtimeInvalidation } from '@/lib/realtime';
import { sortByIds } from '@/lib/reorder';

import { createList, deleteList, fetchList, fetchLists, renameList, reorderLists, type ListSummary } from './api';

export function useLists(householdId: string | undefined) {
  const enabled = !!householdId;
  // Cambios en listas o en sus ítems (para los contadores) refrescan la pantalla.
  useRealtimeInvalidation(
    `lists-${householdId}`,
    [{ table: 'lists', filter: `household_id=eq.${householdId}` }, { table: 'list_items' }],
    [queryKeys.lists(householdId ?? '')],
    enabled,
  );
  return useQuery({
    queryKey: queryKeys.lists(householdId ?? ''),
    queryFn: () => fetchLists(householdId!),
    enabled,
  });
}

export function useList(listId: string) {
  return useQuery({ queryKey: queryKeys.list(listId), queryFn: () => fetchList(listId) });
}

export function useListMutations(householdId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.lists(householdId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (name: string) => createList(householdId, name), onSuccess: refresh }),
    rename: useMutation({
      mutationFn: ({ listId, name }: { listId: string; name: string }) => renameList(listId, name),
      onSuccess: (_d, { listId }) => {
        refresh();
        queryClient.invalidateQueries({ queryKey: queryKeys.list(listId) });
      },
    }),
    remove: useMutation({ mutationFn: deleteList, onSuccess: refresh }),
    /** Orden nuevo tras arrastrar. Optimista: la fila se queda donde la sueltas; si falla, vuelve a su sitio. */
    reorder: useMutation({
      mutationFn: (ids: string[]) => reorderLists(ids),
      onMutate: async (ids) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<ListSummary[]>(key);
        if (previous) queryClient.setQueryData(key, sortByIds(previous, ids));
        return { previous };
      },
      onError: (error, _ids, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
        notifyError(error);
      },
      onSettled: refresh,
    }),
  };
}

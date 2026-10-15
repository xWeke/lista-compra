// Hooks de listas: consultas cacheadas + mutaciones + tiempo real.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';
import { useRealtimeInvalidation } from '@/lib/realtime';

import { createList, deleteList, fetchList, fetchLists, renameList } from './api';

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
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.lists(householdId) });

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
  };
}

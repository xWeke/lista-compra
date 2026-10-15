// Hooks de categorías.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';
import { useRealtimeInvalidation } from '@/lib/realtime';

import {
  createCategory,
  deleteCategory,
  fetchCategories,
  swapCategoryOrder,
  updateCategory,
  type Category,
} from './api';

export function useCategories(householdId: string | undefined) {
  const enabled = !!householdId;
  useRealtimeInvalidation(
    `categories-${householdId}`,
    [{ table: 'categories', filter: `household_id=eq.${householdId}` }],
    [queryKeys.categories(householdId ?? '')],
    enabled,
  );
  return useQuery({
    queryKey: queryKeys.categories(householdId ?? ''),
    queryFn: () => fetchCategories(householdId!),
    enabled,
  });
}

export function useCategoryMutations(householdId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.categories(householdId);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['items'] }); // los ítems muestran la categoría
  };

  return {
    create: useMutation({
      mutationFn: ({ name, icon }: { name: string; icon: string | null }) => {
        const current = queryClient.getQueryData<Category[]>(key) ?? [];
        const nextOrder = Math.max(0, ...current.map((c) => c.sort_order)) + 10;
        return createCategory(householdId, name, icon, nextOrder);
      },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...changes }: { id: string; name?: string; icon?: string | null }) =>
        updateCategory(id, changes),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: deleteCategory, onSuccess: refresh }),
    swap: useMutation({
      mutationFn: ({ a, b }: { a: Category; b: Category }) => swapCategoryOrder(a, b),
      onSuccess: refresh,
    }),
  };
}

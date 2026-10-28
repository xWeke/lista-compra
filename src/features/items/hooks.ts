// Hooks de ítems: consulta + Realtime + mutaciones optimistas
// (la pantalla se actualiza al instante y, si el servidor falla, se deshace).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyError } from '@/lib/confirm';
import { queryKeys } from '@/lib/query-client';
import { useRealtimeInvalidation } from '@/lib/realtime';

import {
  addItem,
  addItems,
  archiveCheckedItems,
  deleteItem,
  fetchItems,
  fetchProducts,
  updateItem,
  updateProduct,
  type ItemChanges,
  type ListItem,
  type NewItem,
} from './api';

export function useListItems(listId: string, householdId: string | undefined) {
  useRealtimeInvalidation(
    `items-${listId}`,
    [
      { table: 'list_items', filter: `list_id=eq.${listId}` },
      { table: 'products', filter: `household_id=eq.${householdId}` }, // renombres / cambio de categoría
    ],
    [queryKeys.items(listId), queryKeys.products(householdId ?? '')],
    !!householdId,
  );
  return useQuery({ queryKey: queryKeys.items(listId), queryFn: () => fetchItems(listId) });
}

/** Catálogo del hogar, para autocompletar al añadir. */
export function useProducts(householdId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products(householdId ?? ''),
    queryFn: () => fetchProducts(householdId!),
    enabled: !!householdId,
  });
}

export function useItemMutations(listId: string, householdId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.items(listId);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: queryKeys.lists(householdId) });
  };

  /** Aplica un cambio local inmediato y devuelve cómo deshacerlo. */
  const optimistic = async (apply: (items: ListItem[]) => ListItem[]) => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<ListItem[]>(key);
    if (previous) queryClient.setQueryData(key, apply(previous));
    return { previous };
  };
  const rollback = (error: unknown, _vars: unknown, ctx?: { previous?: ListItem[] }) => {
    if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    notifyError(error);
  };

  return {
    add: useMutation({
      mutationFn: ({ name, categoryId }: { name: string; categoryId?: string | null }) =>
        addItem({ listId, householdId, name, categoryId }),
      onSuccess: () => {
        refresh();
        queryClient.invalidateQueries({ queryKey: queryKeys.products(householdId) });
      },
      onError: notifyError,
    }),
    addMany: useMutation({
      mutationFn: (items: NewItem[]) => addItems(listId, householdId, items),
      onSettled: () => {
        refresh(); // también si falla a medias: se ve lo que sí entró
        queryClient.invalidateQueries({ queryKey: queryKeys.products(householdId) });
      },
      onError: notifyError,
    }),
    update: useMutation({
      mutationFn: ({ id, changes }: { id: string; changes: ItemChanges }) => updateItem(id, changes),
      onMutate: ({ id, changes }) => optimistic((items) => items.map((i) => (i.id === id ? { ...i, ...changes } : i))),
      onError: rollback,
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: deleteItem,
      onMutate: (id: string) => optimistic((items) => items.filter((i) => i.id !== id)),
      onError: rollback,
      onSettled: refresh,
    }),
    clearChecked: useMutation({
      mutationFn: () => archiveCheckedItems(listId),
      onMutate: () => optimistic((items) => items.filter((i) => !i.is_checked)),
      onError: rollback,
      onSettled: refresh,
    }),
    /** Cambiar de categoría desde el modo Organizar. La categoría es del producto (se recuerda para la próxima vez):
     *  se guarda en el catálogo y se quita la que el ítem tuviera propia. Optimista: salta de sección al momento. */
    setCategory: useMutation({
      mutationFn: async ({ item, categoryId }: { item: ListItem; categoryId: string | null }) => {
        await updateProduct(item.product.id, { default_category_id: categoryId });
        if (item.category_id) await updateItem(item.id, { category_id: null });
      },
      onMutate: ({ item, categoryId }) =>
        optimistic((items) =>
          items.map((i) =>
            i.product.id === item.product.id
              ? {
                  ...i,
                  category_id: i.id === item.id ? null : i.category_id,
                  product: { ...i.product, default_category_id: categoryId },
                }
              : i,
          ),
        ),
      onError: rollback,
      onSettled: () => {
        refresh();
        queryClient.invalidateQueries({ queryKey: queryKeys.products(householdId) });
      },
    }),
    updateProduct: useMutation({
      mutationFn: ({
        productId,
        changes,
      }: {
        productId: string;
        changes: { name?: string; default_category_id?: string | null };
      }) => updateProduct(productId, changes),
      onSuccess: () => {
        refresh();
        queryClient.invalidateQueries({ queryKey: queryKeys.products(householdId) });
      },
      onError: notifyError,
    }),
  };
}

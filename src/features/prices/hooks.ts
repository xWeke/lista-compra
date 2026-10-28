// Hooks de precios de los súpers.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notifyError } from '@/lib/confirm';
import { queryKeys } from '@/lib/query-client';
import { useRealtimeInvalidation } from '@/lib/realtime';

import { fetchStoreLinks, fetchStores, searchStoreProducts, setStoreLink } from './api';

export function useStores() {
  // Cambian muy poco (los súpers y la hora del último volcado): sin tiempo real, se refrescan cada 10 min.
  return useQuery({ queryKey: queryKeys.stores, queryFn: fetchStores, staleTime: 10 * 60_000 });
}

/** Emparejamientos de los productos de una lista en un súper (empareja solos los que falten). */
export function useStoreLinks(storeId: string, productIds: string[]) {
  const ids = [...new Set(productIds)].sort();
  useRealtimeInvalidation(`links-${storeId}`, [{ table: 'product_store_links' }], [['storeLinks', storeId]]);
  return useQuery({
    queryKey: queryKeys.storeLinks(storeId, ids),
    queryFn: () => fetchStoreLinks(storeId, ids),
    enabled: ids.length > 0,
    placeholderData: (previous) => previous, // al añadir un producto no "parpadea" el resumen
  });
}

export function useStoreSearch(storeId: string, query: string) {
  return useQuery({
    queryKey: queryKeys.storeSearch(storeId, query.trim()),
    queryFn: () => searchStoreProducts(storeId, query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useSetStoreLink(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, storeProductId }: { productId: string; storeProductId: string | null }) =>
      setStoreLink(productId, storeId, storeProductId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storeLinks', storeId] }),
    onError: notifyError,
  });
}

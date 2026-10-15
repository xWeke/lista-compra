// Suscripción Realtime genérica: cuando Postgres notifica un cambio en alguna de las
// tablas indicadas, se invalidan las query keys → TanStack Query vuelve a pedir los datos.
// Con 2 usuarios, refetch tras cada cambio es barato y mucho más simple que fusionar eventos.
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

export type RealtimeTable = {
  table: 'lists' | 'list_items' | 'categories' | 'products';
  /** Filtro de Realtime, p. ej. `list_id=eq.<uuid>` (los DELETE no se pueden filtrar). */
  filter?: string;
};

export function useRealtimeInvalidation(
  channelName: string,
  tables: RealtimeTable[],
  keys: QueryKey[],
  enabled = true,
) {
  const queryClient = useQueryClient();
  // Claves estables para el efecto (los arrays se recrean en cada render).
  const tablesSig = JSON.stringify(tables);
  const keysSig = JSON.stringify(keys);

  useEffect(() => {
    if (!enabled) return;
    const parsedTables = JSON.parse(tablesSig) as RealtimeTable[];
    const parsedKeys = JSON.parse(keysSig) as QueryKey[];
    const invalidate = () => parsedKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

    // Sufijo único: dos pantallas montadas a la vez no deben compartir canal.
    let channel = supabase.channel(`${channelName}-${Math.random().toString(36).slice(2, 10)}`);
    for (const t of parsedTables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: t.table, filter: t.filter },
        invalidate,
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, tablesSig, keysSig, enabled, queryClient]);
}

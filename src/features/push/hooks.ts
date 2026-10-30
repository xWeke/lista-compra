// Hooks de los avisos al móvil: estado en este dispositivo + activar/desactivar.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';

import { disablePush, enablePush, getPushStatus } from './api';

export function usePushStatus() {
  return useQuery({ queryKey: queryKeys.pushStatus, queryFn: getPushStatus, staleTime: Infinity });
}

export function usePushToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => (on ? enablePush() : disablePush()),
    // También si falla: p. ej. al denegar el permiso el estado pasa a 'denied'
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.pushStatus }),
  });
}

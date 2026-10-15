// Hogar del usuario actual. Toda la app trabaja dentro de un hogar.
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

export type Household = { id: string; name: string };

async function fetchHousehold(userId: string): Promise<Household | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household:households(id, name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.household ?? null;
}

/** Devuelve el hogar del usuario (o null si aún no se ha ejecutado setup_household.sql). */
export function useHousehold() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: [...queryKeys.household, userId],
    queryFn: () => fetchHousehold(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
}

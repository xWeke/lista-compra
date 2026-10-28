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

/** Nombres visibles de los miembros del hogar, por id de usuario. RLS solo devuelve el propio perfil
 *  y los de quien comparte hogar contigo. */
async function fetchMemberNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, display_name');
  if (error) throw error;
  return Object.fromEntries(data.map((p) => [p.id, p.display_name]));
}

export function useMemberNames(householdId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members(householdId ?? ''),
    queryFn: fetchMemberNames,
    enabled: !!householdId,
    staleTime: 5 * 60_000, // los nombres casi nunca cambian
  });
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

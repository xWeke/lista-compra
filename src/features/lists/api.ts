// Acceso a datos de listas. Solo funciones async que hablan con Supabase (sin React).
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type ListSummary = Tables<'list_summaries'> & { id: string; name: string };
export type List = Tables<'lists'>;

export async function fetchLists(householdId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('list_summaries')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data as ListSummary[];
}

export async function fetchList(listId: string): Promise<List> {
  const { data, error } = await supabase.from('lists').select('*').eq('id', listId).single();
  if (error) throw error;
  return data;
}

export async function createList(householdId: string, name: string): Promise<List> {
  const { data, error } = await supabase
    .from('lists')
    .insert({ household_id: householdId, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameList(listId: string, name: string) {
  const { error } = await supabase.from('lists').update({ name: name.trim() }).eq('id', listId);
  if (error) throw error;
}

export async function deleteList(listId: string) {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw error;
}

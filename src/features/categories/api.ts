// Acceso a datos de categorías.
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Category = Tables<'categories'>;

export async function fetchCategories(householdId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createCategory(householdId: string, name: string, icon: string | null, sortOrder: number) {
  const { error } = await supabase
    .from('categories')
    .insert({ household_id: householdId, name: name.trim(), icon, sort_order: sortOrder });
  if (error) throw error;
}

export async function updateCategory(id: string, changes: { name?: string; icon?: string | null }) {
  const { error } = await supabase.from('categories').update(changes).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/** Guarda el orden nuevo (ids de arriba abajo) en una sola transacción: función SQL reorder_categories. */
export async function reorderCategories(ids: string[]) {
  const { error } = await supabase.rpc('reorder_categories', { ids });
  if (error) throw error;
}

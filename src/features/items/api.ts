// Acceso a datos de ítems de lista y del catálogo de productos.
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export const UNITS = ['ud', 'kg', 'g', 'l', 'ml', 'pack'] as const;
export type Unit = (typeof UNITS)[number];

export type Product = Tables<'products'>;
export type ListItem = Tables<'list_items'> & {
  product: Pick<Product, 'id' | 'name' | 'default_category_id' | 'default_unit'>;
};

/** Igual que public.normalize_name en SQL: minúsculas, sin tildes, sin espacios extremos. */
export function normalizeName(value: string) {
  return value.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Categoría efectiva de un ítem: la suya propia o, si no tiene, la del producto. */
export function itemCategoryId(item: ListItem) {
  return item.category_id ?? item.product.default_category_id;
}

export async function fetchItems(listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('*, product:products(id, name, default_category_id, default_unit)')
    .eq('list_id', listId)
    .is('archived_at', null)
    .order('created_at');
  if (error) throw error;
  return data as ListItem[];
}

export async function fetchProducts(householdId: string): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').eq('household_id', householdId).order('name');
  if (error) throw error;
  return data;
}

/** Busca el producto por nombre normalizado y, si no existe, lo crea en el catálogo. */
async function findOrCreateProduct(householdId: string, name: string, categoryId: string | null): Promise<Product> {
  const find = () =>
    supabase
      .from('products')
      .select('*')
      .eq('household_id', householdId)
      .eq('name_normalized', normalizeName(name))
      .maybeSingle();

  const existing = await find();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from('products')
    .insert({ household_id: householdId, name: name.trim(), default_category_id: categoryId })
    .select()
    .single();
  if (!created.error) return created.data;

  // 23505 = clave duplicada: lo ha creado el otro usuario a la vez. Lo leemos.
  if (created.error.code === '23505') {
    const again = await find();
    if (again.data) return again.data;
  }
  throw created.error;
}

/**
 * Añade un producto a la lista. Si ya estaba (sin archivar):
 *  - marcado como comprado → se desmarca;
 *  - pendiente → se suma 1 a la cantidad.
 */
export async function addItem(params: {
  listId: string;
  householdId: string;
  name: string;
  categoryId?: string | null;
}) {
  const product = await findOrCreateProduct(params.householdId, params.name, params.categoryId ?? null);

  const { data: current, error: findError } = await supabase
    .from('list_items')
    .select('id, is_checked, quantity')
    .eq('list_id', params.listId)
    .eq('product_id', product.id)
    .is('archived_at', null)
    .maybeSingle();
  if (findError) throw findError;

  if (current) {
    const changes = current.is_checked ? { is_checked: false } : { quantity: Number(current.quantity) + 1 };
    const { error } = await supabase.from('list_items').update(changes).eq('id', current.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('list_items')
    .insert({ list_id: params.listId, product_id: product.id, unit: product.default_unit });
  if (error) throw error;
}

export type ItemChanges = Partial<Pick<ListItem, 'quantity' | 'unit' | 'note' | 'is_checked' | 'category_id'>>;

export async function updateItem(itemId: string, changes: ItemChanges) {
  const { error } = await supabase.from('list_items').update(changes).eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string) {
  const { error } = await supabase.from('list_items').delete().eq('id', itemId);
  if (error) throw error;
}

/** "Limpiar comprados": se archivan (no se borran) para conservar el historial. */
export async function archiveCheckedItems(listId: string) {
  const { error } = await supabase
    .from('list_items')
    .update({ archived_at: new Date().toISOString() })
    .eq('list_id', listId)
    .eq('is_checked', true)
    .is('archived_at', null);
  if (error) throw error;
}

/** Cambios en el producto del catálogo (afectan a todas las listas). */
export async function updateProduct(
  productId: string,
  changes: { name?: string; default_category_id?: string | null },
) {
  const { error } = await supabase.from('products').update(changes).eq('id', productId);
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe otro producto con ese nombre.');
    throw error;
  }
}

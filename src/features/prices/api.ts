// Precios de los súpers: catálogo volcado cada noche (store_products) y emparejamiento de vuestros
// productos con los del súper (product_store_links). Ver supabase/migrations/*_store_catalogs.sql.
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Store = Tables<'stores'>;
export type StoreProduct = Tables<'store_products'>;
/** Emparejamiento de un producto vuestro en un súper. store_product null = "no lo compramos aquí". */
export type StoreLink = Tables<'product_store_links'> & { store_product: StoreProduct | null };

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('*').order('sort_order');
  if (error) throw error;
  return data;
}

/**
 * Emparejamientos de esos productos en un súper. Antes, los que aún no tengan pareja se emparejan solos
 * (función SQL auto_link_products: el más parecido y, entre los parecidos, el más barato por kg/L).
 */
export async function fetchStoreLinks(storeId: string, productIds: string[]): Promise<StoreLink[]> {
  if (!productIds.length) return [];
  const auto = await supabase.rpc('auto_link_products', { p_store: storeId, p_product_ids: productIds });
  if (auto.error) throw auto.error;

  const { data, error } = await supabase
    .from('product_store_links')
    .select('*, store_product:store_products(*)')
    .eq('store_id', storeId)
    .in('product_id', productIds);
  if (error) throw error;
  return data as StoreLink[];
}

export async function searchStoreProducts(storeId: string, query: string): Promise<StoreProduct[]> {
  const { data, error } = await supabase.rpc('search_store_products', { p_store: storeId, p_query: query.trim() });
  if (error) throw error;
  return data;
}

/** Elegir a mano el producto del súper (o null = "no lo compramos aquí"). Se recuerda para siempre. */
export async function setStoreLink(productId: string, storeId: string, storeProductId: string | null) {
  const { error } = await supabase
    .from('product_store_links')
    .upsert(
      { product_id: productId, store_id: storeId, store_product_id: storeProductId, matched_by: 'manual' },
      { onConflict: 'product_id,store_id' },
    );
  if (error) throw error;
}

// Unidades de la lista que se pueden pasar a la del precio de referencia del súper (€/kg, €/L).
const TO_REFERENCE: Record<string, { format: string; factor: number }> = {
  kg: { format: 'kg', factor: 1 },
  g: { format: 'kg', factor: 0.001 },
  l: { format: 'l', factor: 1 },
  ml: { format: 'l', factor: 0.001 },
};

/**
 * Lo que costaría una línea de la lista con ese producto del súper:
 *  - por peso o volumen ("1,5 kg" de plátanos) con el precio por kg/L del súper;
 *  - si no ("6 ud" de leche), cantidad × precio del envase.
 */
export function lineCost(quantity: number, unit: string, sp: StoreProduct): number {
  const ref = TO_REFERENCE[unit];
  if (ref && sp.reference_price !== null && sp.reference_format?.toLowerCase() === ref.format) {
    return quantity * ref.factor * Number(sp.reference_price);
  }
  return quantity * Number(sp.price);
}

export type PriceLine = { productId: string; quantity: number; unit: string };
export type PricedLine<T extends PriceLine> = T & { link: StoreLink | undefined; cost: number | null };

/** Cuesta cada línea en el súper y el total. `missing` = líneas sin precio (sin pareja o "no lo compramos aquí"). */
export function priceLines<T extends PriceLine>(lines: T[], links: StoreLink[]) {
  const byProduct = new Map(links.map((l) => [l.product_id, l]));
  const priced: PricedLine<T>[] = lines.map((line) => {
    const link = byProduct.get(line.productId);
    const sp = link?.store_product;
    return { ...line, link, cost: sp ? lineCost(line.quantity, line.unit, sp) : null };
  });
  return {
    lines: priced,
    total: priced.reduce((sum, l) => sum + (l.cost ?? 0), 0),
    missing: priced.filter((l) => l.cost === null).length,
  };
}

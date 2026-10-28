// Edge Function "sync-mercadona": vuelca el catálogo de la tienda online de Mercadona (precios del
// almacén de Madrid) en public.store_products. La lanza pg_cron cada noche (supabase/setup_catalog_sync.sql).
//
// Fuente: la API que usa la propia web tienda.mercadona.es (no es un servicio oficial; si cambia, habrá que
// adaptar esto). ~150 subcategorías, ~4.300 productos, ~5 MB: se piden de una en una, con pausa, para no
// cargar su web (desde los servidores de Supabase, en paralelo, respondía 403).
//
// Seguridad: solo se ejecuta con la cabecera x-sync-secret correcta (el secreto vive en Vault y lo
// comprueba la función SQL check_sync_secret). Escribe con service_role, que la propia Supabase da a
// las Edge Functions: esa clave no sale de Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const STORE_ID = 'mercadona';
const API = 'https://tienda.mercadona.es/api';
// Almacén = zona de precios. mad1 = Madrid. Se puede cambiar con el secret MERCADONA_WAREHOUSE.
const WAREHOUSE = Deno.env.get('MERCADONA_WAREHOUSE') || 'mad1';
const PAUSE_MS = 300; // entre petición y petición
const RETRY_WAITS_MS = [2_000, 5_000, 10_000]; // si responde 403/429/5xx
// La Edge Function tiene ~150 s: a partir de aquí no se reintenta (mejor guardar lo que haya).
const DEADLINE_MS = 115_000;
// Si salen muchos menos productos de lo normal, algo ha fallado: no se marca nada como desaparecido.
const MIN_EXPECTED = 2000;

type MercadonaProduct = {
  id: string;
  display_name: string;
  packaging: string | null;
  published: boolean;
  share_url: string | null;
  thumbnail: string | null;
  categories?: { name: string }[];
  price_instructions: {
    unit_price: string;
    reference_price: string | null;
    reference_format: string | null;
    unit_size: number | null;
    size_format: string | null;
    is_pack: boolean;
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(path: string, deadline: number): Promise<T> {
  const url = `${API}${path}?lang=es&wh=${WAREHOUSE}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'lista-compra (uso personal)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 403 || res.status === 429 || res.status >= 500;
    const wait = RETRY_WAITS_MS[attempt];
    if (!retryable || wait === undefined || Date.now() + wait > deadline) {
      console.error('Mercadona', path, res.status, res.headers.get('server'), (await res.text()).slice(0, 200));
      throw new Error(`${path}: HTTP ${res.status}`);
    }
    await res.body?.cancel();
    await sleep(wait);
  }
}

const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: authorized, error: authError } = await admin.rpc('check_sync_secret', {
    secret: req.headers.get('x-sync-secret') ?? '',
  });
  // Si la comprobación misma falla (permisos, función inexistente…), se dice: no es lo mismo que un secreto malo.
  if (authError) {
    console.error('check_sync_secret falló', authError.message);
    return Response.json({ ok: false, error: `Comprobando el secreto: ${authError.message}` }, { status: 500 });
  }
  if (authorized !== true) return new Response('No autorizado', { status: 401 });

  const started = new Date().toISOString();
  const t0 = Date.now();
  try {
    // 1. Subcategorías
    const deadline = t0 + DEADLINE_MS;
    const tree = await getJson<{ results: { categories: { id: number }[] }[] }>('/categories/', deadline);
    const subcategories = tree.results.flatMap((top) => top.categories.map((c) => c.id));

    // 2. Productos de cada subcategoría, de una en una (un producto puede salir en varias: se queda uno).
    //    Si alguna falla, se sigue: se guarda lo que haya y se informa de cuáles fallaron.
    const products = new Map<string, MercadonaProduct>();
    const failed: string[] = [];
    for (const id of subcategories) {
      try {
        const page = await getJson<{ categories: { products: MercadonaProduct[] }[] }>(`/categories/${id}/`, deadline);
        for (const group of page.categories ?? []) for (const p of group.products ?? []) products.set(p.id, p);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : String(e));
      }
      await sleep(PAUSE_MS);
    }
    if (products.size === 0) throw new Error(`No se ha podido descargar nada. ${failed.slice(0, 3).join('; ')}`);
    const complete = failed.length === 0 && products.size >= MIN_EXPECTED;

    // 3. A la tabla (upsert por store_id + external_id; el trigger apunta el historial si cambia el precio)
    const rows = [...products.values()]
      .filter((p) => num(p.price_instructions?.unit_price) !== null)
      .map((p) => ({
        store_id: STORE_ID,
        external_id: String(p.id),
        name: p.display_name.trim(),
        packaging: p.packaging,
        category: p.categories?.[0]?.name ?? null,
        price: num(p.price_instructions.unit_price)!,
        reference_price: num(p.price_instructions.reference_price),
        reference_format: p.price_instructions.reference_format,
        unit_size: num(p.price_instructions.unit_size),
        size_format: p.price_instructions.size_format,
        is_pack: !!p.price_instructions.is_pack,
        image_url: p.thumbnail,
        url: p.share_url,
        available: p.published !== false,
        seen_at: started,
      }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from('store_products')
        .upsert(rows.slice(i, i + 500), { onConflict: 'store_id,external_id' });
      if (error) throw new Error(`Guardando productos: ${error.message}`);
    }

    // 4. Solo con el volcado completo: lo que ya no aparece en la web pasa a no disponible (no se borra:
    //    puede volver y tiene historial) y se apunta la hora. Con un volcado a medias no se "desaparece" nada.
    let gone: number | null = null;
    if (complete) {
      const res = await admin
        .from('store_products')
        .update({ available: false }, { count: 'exact' })
        .eq('store_id', STORE_ID)
        .eq('available', true)
        .lt('seen_at', started);
      if (res.error) throw new Error(`Marcando desaparecidos: ${res.error.message}`);
      gone = res.count;
      await admin.from('stores').update({ catalog_synced_at: new Date().toISOString() }).eq('id', STORE_ID);
    }

    const summary = {
      ok: complete,
      products: rows.length,
      gone,
      failed: failed.length,
      failedExamples: failed.slice(0, 5),
      seconds: Math.round((Date.now() - t0) / 1000),
    };
    console.log('sync-mercadona', JSON.stringify(summary));
    return Response.json(summary, { status: complete ? 200 : 207 });
  } catch (e) {
    console.error('sync-mercadona falló', String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});

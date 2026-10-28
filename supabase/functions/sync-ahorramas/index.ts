// Edge Function "sync-ahorramas": vuelca el catálogo de www.ahorramas.com en public.store_products.
//
// Ahorramas no tiene API: se leen sus páginas de categoría (HTML), que su robots.txt permite (prohíbe el
// buscador, las llamadas Search-ShowAjax y "ver-todo": no se usan). Si cambian el diseño de la web, habrá
// que adaptar parseProducts().
//
// Por partes: su web tarda hasta ~90 s en una categoría grande y la función tiene ~150 s. Cada ejecución
// descarga las partes (categorías) más antiguas durante ~90 s y apunta cuándo en store_sync_parts.
// pg_cron la lanza cada 10 min de madrugada; si todo está al día (< 20 h), no hace nada.
//
// Seguridad: igual que sync-mercadona (cabecera x-sync-secret comprobada contra Vault).
import { createClient } from 'npm:@supabase/supabase-js@2';

const STORE_ID = 'ahorramas';
const SITE = 'https://www.ahorramas.com';
const PAGE_SIZE = 1000; // productos por página (la web lo admite; menos peticiones)
// No empezar otra parte pasado este tiempo: la más lenta (Frescos) tarda ~90 s y el límite es ~150 s.
const BUDGET_MS = 45_000;
const FRESH_MS = 20 * 3600_000; // una parte descargada hace menos de esto no se repite
const PAUSE_MS = 1000;
const STALE_DAYS = 3; // producto no visto en estos días = no disponible
// Secciones de nivel 1 que repiten productos de otras (ofertas, temporada…): no se descargan.
const SKIP_TOP = new Set(['navidad', 'ofertas', 'ofertas-destacadas', 'novedades', 'freidora-de-aire---airfryer']);
// Secciones demasiado grandes para una sola página: se descargan por sus subcategorías.
const SPLIT_TOP = new Set(['alimentacion']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'lista-compra (uso personal)', Accept: 'text/html,application/xml' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

/** Partes a descargar, sacadas del sitemap de categorías (permitido por robots.txt). */
async function discoverParts(): Promise<string[]> {
  const xml = await getText(`${SITE}/sitemap_2-category.xml`);
  const paths = [...xml.matchAll(/<loc>https:\/\/www\.ahorramas\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  const parts = new Set<string>();
  for (const path of paths) {
    const segs = path.split('/').filter(Boolean);
    if (!segs.length || segs[0] === 'marcas' || SKIP_TOP.has(segs[0]) || segs.includes('ver-todo')) continue;
    if (segs.length === 1 && !SPLIT_TOP.has(segs[0])) parts.add(`/${segs[0]}/`);
    if (segs.length === 2 && SPLIT_TOP.has(segs[0])) parts.add(`/${segs[0]}/${segs[1]}/`);
  }
  return [...parts].sort();
}

const ENTITIES: Record<string, string> = {
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü',
  ordm: 'º',
  ordf: 'ª',
  nbsp: ' ',
};

const decode = (s: string) =>
  s
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&([a-zA-Z]+);/g, (whole, name: string) => ENTITIES[name] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();

/** "1,79€/100 ML." → precio de referencia en €/L, €/kg, €/ud… */
function parseReference(text: string): { price: number; format: string } | null {
  const m = decode(text).match(/^([\d.,]+)\s*€\s*\/\s*(.+?)\.?$/);
  if (!m) return null;
  const value = Number(m[1].replace(/\./g, '').replace(',', '.'));
  const unit = m[2].toUpperCase().replace(/\s+/g, ' ');
  if (!Number.isFinite(value)) return null;
  if (/^(KILO|KG|KG\.PESO|KGS?)$/.test(unit)) return { price: value, format: 'kg' };
  if (/^(LITRO|L|LT)$/.test(unit)) return { price: value, format: 'L' };
  if (/^100 ?(ML|CL)$/.test(unit)) return { price: value * 10, format: 'L' };
  if (/^100 ?(GR?|GRS)$/.test(unit)) return { price: value * 10, format: 'kg' };
  if (unit === 'UNIDAD') return { price: value, format: 'ud' };
  if (unit === 'DOCENA') return { price: value, format: 'dz' };
  return { price: value, format: unit.toLowerCase() };
}

type Parsed = {
  external_id: string;
  name: string;
  price: number;
  reference_price: number | null;
  reference_format: string | null;
  image_url: string | null;
  url: string | null;
  category: string | null;
  is_pack: boolean;
};

/** Productos de una página de categoría. Cada producto empieza por <div class="product" data-pid="…">. */
function parseProducts(html: string): Parsed[] {
  const out: Parsed[] = [];
  for (const block of html.split('<div class="product" data-pid="').slice(1)) {
    const id = block.slice(0, block.indexOf('"'));
    const name = block.match(/<h2 class="link product-name-gtm"[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    // Precio actual (si hay oferta, el tachado va en <del> y el vigente en "sales")
    const price = block.match(/<span class="sales">[\s\S]*?content="([\d.]+)"/)?.[1];
    if (!id || !name || !price) continue;
    const ref = block.match(/unit-price-per-unit grey">\s*([^<]*?)\s*<\/span>/)?.[1];
    const reference = ref ? parseReference(ref) : null;
    const cleanName = decode(name);
    out.push({
      external_id: id,
      name: cleanName,
      price: Number(price),
      reference_price: reference ? Math.round(reference.price * 1000) / 1000 : null,
      reference_format: reference?.format ?? null,
      image_url: block.match(/class="tile-image"\s+src="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') ?? null,
      url: (() => {
        const href = block.match(/href="(\/[^"]+\.html)"/)?.[1];
        return href ? `${SITE}${href}` : null;
      })(),
      category: decode(block.match(/data-category1="([^"]*)"/)?.[1] ?? '') || null,
      is_pack: /\bpack\b|\d+\s*x\s*\d+/i.test(cleanName),
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: authorized, error: authError } = await admin.rpc('check_sync_secret', {
    secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (authError)
    return Response.json({ ok: false, error: `Comprobando el secreto: ${authError.message}` }, { status: 500 });
  if (authorized !== true) return new Response('No autorizado', { status: 401 });

  const t0 = Date.now();
  try {
    // 1. Partes conocidas + las nuevas del sitemap
    const discovered = await discoverParts();
    if (discovered.length) {
      await admin.from('store_sync_parts').upsert(
        discovered.map((part) => ({ store_id: STORE_ID, part })),
        { onConflict: 'store_id,part', ignoreDuplicates: true },
      );
    }
    const { data: state, error: stateError } = await admin
      .from('store_sync_parts')
      .select('part, synced_at')
      .eq('store_id', STORE_ID)
      .order('synced_at', { ascending: true, nullsFirst: true });
    if (stateError) throw new Error(`Leyendo partes: ${stateError.message}`);
    const pending = (state ?? []).filter(
      (s) => discovered.includes(s.part) && (!s.synced_at || Date.now() - Date.parse(s.synced_at) > FRESH_MS),
    );

    // 2. Partes pendientes, de una en una, mientras quede tiempo
    const done: { part: string; products: number }[] = [];
    const failed: string[] = [];
    for (const { part } of pending) {
      if (Date.now() - t0 > BUDGET_MS) break;
      const seenAt = new Date().toISOString();
      try {
        const products = new Map<string, Parsed>();
        for (let start = 0; ; start += PAGE_SIZE) {
          const page = parseProducts(await getText(`${SITE}${part}?start=${start}&sz=${PAGE_SIZE}`));
          for (const p of page) products.set(p.external_id, p);
          if (page.length < PAGE_SIZE) break;
          await sleep(PAUSE_MS);
        }
        const rows = [...products.values()].map((p) => ({
          ...p,
          store_id: STORE_ID,
          available: true,
          seen_at: seenAt,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await admin
            .from('store_products')
            .upsert(rows.slice(i, i + 500), { onConflict: 'store_id,external_id' });
          if (error) throw new Error(`Guardando: ${error.message}`);
        }
        await admin
          .from('store_sync_parts')
          .update({ synced_at: seenAt, products: rows.length, error: null })
          .eq('store_id', STORE_ID)
          .eq('part', part);
        done.push({ part, products: rows.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failed.push(`${part}: ${message}`);
        await admin.from('store_sync_parts').update({ error: message }).eq('store_id', STORE_ID).eq('part', part);
      }
      await sleep(PAUSE_MS);
    }

    // 3. Productos que llevan días sin aparecer en ninguna parte: no disponibles (no se borran)
    const staleBefore = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
    await admin
      .from('store_products')
      .update({ available: false })
      .eq('store_id', STORE_ID)
      .eq('available', true)
      .lt('seen_at', staleBefore);

    // 4. "Precios de la web del…" = la parte más antigua (si todas se han descargado alguna vez)
    const { data: after } = await admin.from('store_sync_parts').select('synced_at').eq('store_id', STORE_ID);
    const dates = (after ?? []).map((s) => s.synced_at);
    if (dates.length && dates.every(Boolean)) {
      const oldest = dates.map((d) => Date.parse(d!)).reduce((a, b) => Math.min(a, b));
      await admin
        .from('stores')
        .update({ catalog_synced_at: new Date(oldest).toISOString() })
        .eq('id', STORE_ID);
    }

    const summary = {
      ok: failed.length === 0,
      parts: discovered.length,
      pendingBefore: pending.length,
      done,
      failed,
      seconds: Math.round((Date.now() - t0) / 1000),
    };
    console.log('sync-ahorramas', JSON.stringify(summary));
    return Response.json(summary, { status: failed.length ? 207 : 200 });
  } catch (e) {
    console.error('sync-ahorramas falló', String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});

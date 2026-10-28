// Edge Function "scan-list": recibe la foto de una lista de la compra y devuelve los productos que contiene,
// leídos por Gemini (Google). Se ejecuta en Supabase (Deno), no en el navegador: así la clave de Gemini
// nunca llega al móvil ni al repo. Vive en los "Secrets" del proyecto Supabase:
//   GEMINI_API_KEY  (obligatoria)   GEMINI_MODEL  (opcional, por defecto gemini-3.8-flash)
//
// Seguridad: solo atiende a usuarios con sesión que pertenezcan a un hogar (se comprueba con su propio
// token, pasando por RLS). Las categorías que se ofrecen a la IA son las del hogar de ese usuario.
import { createClient } from 'npm:@supabase/supabase-js@2';

const UNITS = ['ud', 'kg', 'g', 'l', 'ml', 'pack'];
const MAX_ITEMS = 60;
const MAX_IMAGE_BASE64 = 6_000_000; // ~4,5 MB de imagen; la app la reduce antes a ~1600 px (unos 300 KB)

// Webs que pueden llamar a la función desde el navegador (CORS): la publicada y el servidor de desarrollo.
const ALLOWED_ORIGINS = ['https://xweke.github.io', 'http://localhost:5173', 'http://localhost:4173'];

type ScannedItem = { name: string; quantity: number; unit: string; category_id: string | null };

function cors(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function prompt(categories: string[]) {
  return `Esta foto es una lista de la compra (escrita a mano o impresa, normalmente en español).
Extrae cada producto que haya que comprar, en el orden en que aparecen.

Reglas:
- name: nombre del producto en español, con la primera letra en mayúscula y sin la cantidad.
  Corrige faltas de ortografía evidentes ("leche" y no "lexe"). No inventes productos que no estén.
- quantity y unit: si la línea indica cantidad ("2 leches", "1 kg tomates", "pan x3", "6 huevos"), ponla.
  Unidades permitidas: ${UNITS.join(', ')}. "docena" = 12 ud; "litro" = l; "paquete" = pack.
  Si no indica cantidad, quantity 1 y unit "ud".
- category: la categoría más adecuada de esta lista: ${categories.map((c) => `"${c}"`).join(', ')}.
  Si ninguna encaja, "".
- Ignora lo tachado, títulos, fechas, precios y todo lo que no sea un producto.
- Si la foto no contiene una lista de la compra, devuelve items vacío.`;
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, headers);

  // --- ¿Quién llama? Con su token, como cualquier consulta de la app (RLS incluido) ---
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) return json({ error: 'Inicia sesión para usar la foto.' }, 401, headers);

  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order');
  const { count } = await supabase.from('household_members').select('*', { count: 'exact', head: true });
  if (catError || !count) return json({ error: 'Tu usuario no pertenece a ningún hogar.' }, 403, headers);

  // --- La foto ---
  let body: { image?: unknown; mimeType?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Petición no válida.' }, 400, headers);
  }
  const image = typeof body.image === 'string' ? body.image : '';
  const mimeType = typeof body.mimeType === 'string' && body.mimeType.startsWith('image/') ? body.mimeType : '';
  if (!image || !mimeType) return json({ error: 'Falta la foto.' }, 400, headers);
  if (image.length > MAX_IMAGE_BASE64) return json({ error: 'La foto es demasiado grande.' }, 413, headers);

  // --- Gemini: respuesta en JSON con un esquema fijo (no hay que "parsear" texto libre) ---
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'Falta configurar GEMINI_API_KEY en Supabase.' }, 500, headers);
  // Modelo principal y, si está saturado (503) o sin cupo (429), uno más ligero con su propio cupo gratuito.
  const models = [...new Set([Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.5-flash-lite'])];
  const categoryNames = (categories ?? []).map((c) => c.name);

  const itemSchema: Record<string, unknown> = {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      quantity: { type: 'NUMBER' },
      unit: { type: 'STRING', enum: UNITS },
      // Texto libre (Gemini rechaza listas de valores con ""): se empareja después con las del hogar.
      category: { type: 'STRING' },
    },
    required: ['name', 'quantity', 'unit', 'category'],
  };

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt(categoryNames) }, { inline_data: { mime_type: mimeType, data: image } }] }],
    generation_config: {
      response_mime_type: 'application/json',
      response_schema: {
        type: 'OBJECT',
        properties: { items: { type: 'ARRAY', items: itemSchema } },
        required: ['items'],
      },
    },
  });

  // Hasta 25 s por modelo (la app espera como mucho 60): si uno se atasca, mejor probar el siguiente.
  let geminiRes: Response | null = null;
  for (const model of models) {
    const started = Date.now();
    try {
      geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: requestBody,
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      console.error('Gemini sin respuesta', model, Date.now() - started, 'ms', String(e));
      geminiRes = null;
      continue;
    }
    console.log('Gemini', model, geminiRes.status, Date.now() - started, 'ms', Math.round(image.length / 1024), 'KB');
    if (geminiRes.status !== 503 && geminiRes.status !== 429) break;
    console.error('Gemini', model, 'saturado o sin cupo:', await geminiRes.text());
  }

  if (!geminiRes) {
    return json({ error: 'La IA está tardando demasiado. Prueba otra vez en un momento.' }, 504, headers);
  }
  if (geminiRes.status === 503) {
    return json({ error: 'La IA está saturada ahora mismo. Prueba otra vez en unos minutos.' }, 503, headers);
  }
  if (geminiRes.status === 429) {
    return json({ error: 'Se ha agotado el uso gratuito de la IA por ahora. Prueba más tarde.' }, 429, headers);
  }
  if (!geminiRes.ok) {
    // El motivo de Google (sin la clave) va también en el mensaje: así se puede diagnosticar desde el móvil.
    const detail = await geminiRes.text();
    console.error('Gemini', geminiRes.status, detail);
    let reason = '';
    try {
      reason = JSON.parse(detail)?.error?.message ?? '';
    } catch {
      reason = detail.slice(0, 200);
    }
    return json(
      { error: `La IA no ha podido leer la foto (${geminiRes.status}${reason ? `: ${reason.slice(0, 200)}` : ''}).` },
      502,
      headers,
    );
  }

  // --- Respuesta: se valida todo (lo que diga la IA es un dato más, no algo de fiar) ---
  const result = await geminiRes.json();
  const text: string = (result.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    console.error('Gemini devolvió algo que no es JSON', text.slice(0, 500));
    return json({ error: 'La IA no ha devuelto una lista válida. Prueba otra vez.' }, 502, headers);
  }

  // Emparejar sin distinguir mayúsculas ni tildes ("lacteos y huevos" = "Lácteos y huevos").
  const norm = (v: string) => v.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const byName = new Map((categories ?? []).map((c) => [norm(c.name), c.id as string]));
  const rawItems = (raw as { items?: unknown }).items;
  const items: ScannedItem[] = (Array.isArray(rawItems) ? rawItems : [])
    .slice(0, MAX_ITEMS)
    .map((it: Record<string, unknown>) => {
      const name = String(it?.name ?? '')
        .trim()
        .slice(0, 80);
      const q = Number(it?.quantity);
      return {
        name,
        quantity: Number.isFinite(q) && q > 0 && q <= 999 ? Math.round(q * 1000) / 1000 : 1,
        unit: UNITS.includes(String(it?.unit)) ? String(it.unit) : 'ud',
        category_id: byName.get(norm(String(it?.category ?? ''))) ?? null,
      };
    })
    .filter((it) => it.name.length > 0);

  return json({ items }, 200, headers);
});

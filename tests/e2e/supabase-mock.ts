// Supabase simulado para las pruebas E2E: intercepta las peticiones del navegador a Supabase
// (Auth y la API REST de PostgREST) y responde con datos en memoria. No hay backend real.
// Implementa solo lo que usa la app: login, select con filtros eq./is.null, insert, update y delete.
import type { Page, Route } from '@playwright/test';

/** Debe coincidir con VITE_SUPABASE_URL del webServer en playwright.config.ts (.invalid nunca resuelve en DNS). */
export const SUPABASE_URL = 'https://supabase.e2e.invalid';

export const HOUSEHOLD_ID = 'hh-1';
export const LIST_ID = 'list-1';
export const USER = { id: 'user-1', email: 'yo@ejemplo.com' };

type Row = Record<string, unknown> & { id: string };

const now = () => new Date().toISOString();
const normalize = (s: string) => s.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Datos de partida: 1 hogar, 2 listas, 3 categorías, 5 productos y 5 ítems (1 ya comprado). */
export function createSeed() {
  const t = now();
  const categories: Row[] = [
    ['cat-fruta', 'Fruta y verdura', '🥦', 10],
    ['cat-lacteos', 'Lácteos y huevos', '🥛', 50],
    ['cat-limpieza', 'Limpieza', '🧽', 90],
  ].map(([id, name, icon, sort_order]) => ({
    id: id as string,
    name,
    icon,
    sort_order,
    household_id: HOUSEHOLD_ID,
    created_at: t,
    updated_at: t,
  }));
  const products: Row[] = [
    ['p-platanos', 'Plátanos', 'cat-fruta', 'kg'],
    ['p-leche', 'Leche entera', 'cat-lacteos', 'ud'],
    ['p-huevos', 'Huevos', 'cat-lacteos', 'ud'],
    ['p-lavavajillas', 'Lavavajillas', 'cat-limpieza', 'ud'],
    ['p-pan', 'Pan de molde', null, 'ud'],
  ].map(([id, name, default_category_id, default_unit]) => ({
    id: id as string,
    name,
    name_normalized: normalize(name as string),
    default_category_id,
    default_unit,
    barcode: null,
    household_id: HOUSEHOLD_ID,
    created_at: t,
    updated_at: t,
  }));
  const list_items: Row[] = [
    ['i-platanos', 'p-platanos', 1.5, 'kg', null, false],
    ['i-leche', 'p-leche', 6, 'ud', 'Sin lactosa', false],
    ['i-huevos', 'p-huevos', 1, 'ud', null, false],
    ['i-lavavajillas', 'p-lavavajillas', 1, 'ud', null, true],
    ['i-pan', 'p-pan', 1, 'ud', null, false],
  ].map(([id, product_id, quantity, unit, note, is_checked]) => ({
    id: id as string,
    list_id: LIST_ID,
    product_id,
    category_id: null,
    quantity,
    unit,
    note,
    is_checked,
    checked_at: null,
    checked_by: null,
    archived_at: null,
    created_by: USER.id,
    created_at: t,
    updated_at: t,
  }));
  const lists: Row[] = [
    { id: LIST_ID, name: 'Compra semanal', sort_order: 0 },
    { id: 'list-2', name: 'Farmacia', sort_order: 1 },
  ].map((l) => ({
    ...l,
    household_id: HOUSEHOLD_ID,
    archived_at: null,
    created_by: USER.id,
    created_at: t,
    updated_at: t,
  }));

  return { categories, products, list_items, lists };
}

export type MockDb = ReturnType<typeof createSeed>;

/** Aplica los filtros PostgREST de la URL (col=eq.valor, col=is.null) a unas filas. */
function applyFilters(rows: Row[], params: URLSearchParams) {
  const reserved = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  let out = rows;
  for (const [col, expr] of params) {
    if (reserved.has(col)) continue;
    if (expr === 'is.null') out = out.filter((r) => r[col] === null || r[col] === undefined);
    else if (expr.startsWith('eq.')) {
      const value = expr.slice(3);
      out = out.filter((r) => String(r[col]) === value);
    }
  }
  return out;
}

/** Aplica `order=col.asc,col2.desc` (como PostgREST). */
function applyOrder<T extends Record<string, unknown>>(rows: T[], params: URLSearchParams) {
  const order = params.get('order');
  if (!order) return rows;
  const keys = order.split(',').map((part) => {
    const [col, dir] = part.split('.');
    return { col, desc: dir === 'desc' };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const x = a[col] as string | number;
      const y = b[col] as string | number;
      if (x === y) continue;
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
      return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function listSummaries(db: MockDb) {
  return db.lists
    .filter((l) => !l.archived_at)
    .map((l) => {
      const items = db.list_items.filter((i) => i.list_id === l.id && !i.archived_at);
      return {
        ...l,
        pending_count: items.filter((i) => !i.is_checked).length,
        checked_count: items.filter((i) => i.is_checked).length,
      };
    });
}

function withProduct(db: MockDb, item: Row) {
  const p = db.products.find((x) => x.id === item.product_id)!;
  return {
    ...item,
    product: { id: p.id, name: p.name, default_category_id: p.default_category_id, default_unit: p.default_unit },
  };
}

function fakeJwt() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, exp, role: 'authenticated', aud: 'authenticated' })}.firma`,
    exp,
  };
}

/** Instala el simulador en la página y devuelve la "base de datos" en memoria (para inspeccionarla en los tests). */
export async function mockSupabase(page: Page, db: MockDb = createSeed()) {
  const user = {
    ...USER,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: now(),
  };

  await page.route(`${SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const respondRows = (rows: unknown[]) => {
      if (!wantsObject) return json(rows);
      if (rows.length === 1) return json(rows[0]);
      return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406);
    };

    // --- Auth ---
    if (path === '/auth/v1/token') {
      const { token, exp } = fakeJwt();
      return json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        refresh_token: 'r',
        user,
      });
    }
    if (path === '/auth/v1/user') return json(user);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });

    // --- REST ---
    const table = path.replace('/rest/v1/', '');
    if (table === 'household_members') return respondRows([{ household: { id: HOUSEHOLD_ID, name: 'Casa' } }]);
    if (table === 'list_summaries')
      return respondRows(applyOrder(applyFilters(listSummaries(db), url.searchParams), url.searchParams));

    const rows = db[table as keyof MockDb] as Row[] | undefined;
    if (!rows) return json({ message: `Tabla no simulada: ${table}` }, 404);
    const present = (r: Row) => (table === 'list_items' ? withProduct(db, r) : r);

    if (method === 'GET')
      return respondRows(applyOrder(applyFilters(rows, url.searchParams), url.searchParams).map(present));

    if (method === 'POST') {
      const body = req.postDataJSON();
      const inserted = (Array.isArray(body) ? body : [body]).map((b: Record<string, unknown>) => {
        const row: Row = {
          id: `${table}-${crypto.randomUUID().slice(0, 8)}`,
          created_at: now(),
          updated_at: now(),
          ...b,
        };
        if (table === 'products') row.name_normalized = normalize(String(row.name));
        if (table === 'list_items')
          Object.assign(row, {
            is_checked: false,
            archived_at: null,
            category_id: null,
            note: null,
            quantity: 1,
            ...b,
          });
        rows.push(row);
        return row;
      });
      return respondRows(inserted.map(present));
    }

    if (method === 'PATCH') {
      const changes = req.postDataJSON();
      const targets = applyFilters(rows, url.searchParams);
      targets.forEach((r) => Object.assign(r, changes, { updated_at: now() }));
      return targets.length && wantsObject ? respondRows(targets.map(present)) : route.fulfill({ status: 204 });
    }

    if (method === 'DELETE') {
      const targets = new Set(applyFilters(rows, url.searchParams));
      const keep = rows.filter((r) => !targets.has(r));
      rows.splice(0, rows.length, ...keep);
      return route.fulfill({ status: 204 });
    }

    return json({ message: `Método no simulado: ${method}` }, 405);
  });

  return db;
}

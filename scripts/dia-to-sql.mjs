// Convierte el catálogo de Dia (CSV que trae el usuario) en SQL para pegar en el SQL Editor de Supabase.
//
// Dia no se vuelca solo como Mercadona y Ahorramas: su web bloquea el acceso automático y no se esquiva desde
// aquí (ver CLAUDE.md). Este script solo importa un fichero ya descargado.
//
// Uso:  npm run import:dia                         (lee ~/Downloads/dia_productos.csv)
//       npm run import:dia -- ruta\al\fichero.csv
// Salida: supabase/imports/dia-parte-N.sql (ignorado por git: son datos y caducan). Se ejecutan en orden;
// la última parte marca como no disponible lo que no venía en el fichero y activa Dia en la app.
//
// CSV esperado: separador ';', coma decimal, cabecera con id;nombre;categoria;precio;precio_por_unidad;
// unidad;url;imagen (sobran columnas, se ignoran).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const STORE_ID = 'dia';
const ROWS_PER_FILE = 2000; // ~0,5 MB por fichero: el SQL Editor lo traga bien
const MIN_ROWS = 1000; // menos = fichero incompleto; no se importa (marcaría casi todo como no disponible)
const OUT_DIR = resolve(import.meta.dirname, '..', 'supabase', 'imports');

const src = process.argv[2] ?? join(homedir(), 'Downloads', 'dia_productos.csv');
if (!existsSync(src)) {
  console.error(`No encuentro ${src}\nUso: npm run import:dia -- ruta\\al\\dia_productos.csv`);
  process.exit(1);
}

/** Separa una línea CSV con ';', respetando campos entre comillas (por si un nombre lleva ';'). */
function splitLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = readFileSync(src, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const head = splitLine(lines.shift());
const need = ['id', 'nombre', 'categoria', 'precio', 'precio_por_unidad', 'unidad', 'url', 'imagen'];
const missing = need.filter((n) => !head.includes(n));
if (missing.length) {
  console.error(`Faltan columnas en el CSV: ${missing.join(', ')}`);
  process.exit(1);
}
const at = Object.fromEntries(need.map((n) => [n, head.indexOf(n)]));

const num = (s) => (s && s.trim() ? Number(s.trim().replace(/\./g, '').replace(',', '.')) : null);
const sql = (s) => (s == null || String(s).trim() === '' ? 'null' : `'${String(s).trim().replace(/'/g, "''")}'`);

/** Precio por unidad de Dia → mismo formato que los demás súpers ('kg', 'L', 'ud'…), que usa lineCost. */
function reference(value, unit) {
  if (value == null || !Number.isFinite(value)) return [null, null];
  const u = (unit ?? '').trim().toLowerCase();
  if (u === 'kilo') return [value, 'kg'];
  if (u === 'litro') return [value, 'L'];
  if (u === '100 gr.') return [value * 10, 'kg'];
  if (u === '100 ml.') return [value * 10, 'L'];
  if (u === 'unidad') return [value, 'ud'];
  if (u === 'docena') return [value, 'dz'];
  return [value, u || null]; // 'lavado', 'metro'…
}

const stamp = new Date().toISOString();
const seen = new Set();
const rows = [];
for (const line of lines) {
  const c = splitLine(line);
  const id = c[at.id]?.trim();
  const price = num(c[at.precio]);
  if (!id || seen.has(id) || price == null || !Number.isFinite(price)) continue;
  seen.add(id);
  const name = c[at.nombre];
  const [refPrice, refFormat] = reference(num(c[at.precio_por_unidad]), c[at.unidad]);
  rows.push(
    `(${sql(STORE_ID)},${sql(id)},${sql(name)},${sql(c[at.categoria])},${price},` +
      `${refPrice == null ? 'null' : Math.round(refPrice * 1000) / 1000},${sql(refFormat)},` +
      `${/\bpack\b|\d+\s*x\s*\d+/i.test(name)},${sql(c[at.imagen])},${sql(c[at.url])},true,'${stamp}')`,
  );
}

if (rows.length < MIN_ROWS) {
  console.error(`Solo ${rows.length} productos válidos: el fichero parece incompleto, no se genera nada.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) if (/^dia-parte-\d+\.sql$/.test(f)) rmSync(join(OUT_DIR, f));

const parts = Math.ceil(rows.length / ROWS_PER_FILE);
for (let i = 0; i < parts; i++) {
  let out =
    `-- Dia, parte ${i + 1} de ${parts} (generado ${stamp} desde ${src})\n` +
    `insert into public.store_products (store_id, external_id, name, category, price, reference_price,\n` +
    `  reference_format, is_pack, image_url, url, available, seen_at) values\n` +
    rows.slice(i * ROWS_PER_FILE, (i + 1) * ROWS_PER_FILE).join(',\n') +
    `\non conflict (store_id, external_id) do update set name = excluded.name, category = excluded.category,\n` +
    `  price = excluded.price, reference_price = excluded.reference_price, reference_format = excluded.reference_format,\n` +
    `  is_pack = excluded.is_pack, image_url = excluded.image_url, url = excluded.url, available = true,\n` +
    `  seen_at = excluded.seen_at;\n`;
  if (i === parts - 1) {
    out +=
      `\n-- Lo que no venía en este fichero ya no está en la web (no se borra: puede tener emparejamientos)\n` +
      `update public.store_products set available = false where store_id = 'dia' and seen_at < '${stamp}';\n` +
      `update public.stores set has_catalog = true, catalog_synced_at = '${stamp}' where id = 'dia';\n`;
  }
  writeFileSync(join(OUT_DIR, `dia-parte-${i + 1}.sql`), out);
}

console.log(`${rows.length} productos → ${parts} ficheros en ${OUT_DIR}`);
console.log('Ejecútalos en orden en el SQL Editor de Supabase (la última parte activa Dia en la app).');

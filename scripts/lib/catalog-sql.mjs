// Piezas comunes de los importadores de catálogo por CSV (Dia, Costco…): leer el CSV y escribir el SQL
// por partes para pegarlo en el SQL Editor de Supabase. Cada súper solo decide cómo se lee su fichero.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROWS_PER_FILE = 2000; // ~0,5 MB por fichero: el SQL Editor lo traga bien
export const OUT_DIR = resolve(import.meta.dirname, '..', '..', 'supabase', 'imports');

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

/** Filas del CSV como objetos {columna: valor}. Sale con error si el fichero no existe o le faltan columnas. */
export function readCsv(src, required, usage) {
  if (!existsSync(src)) fail(`No encuentro ${src}\nUso: ${usage}`);
  const lines = readFileSync(src, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = splitLine(lines.shift()).map((h) => h.trim());
  const missing = required.filter((n) => !head.includes(n));
  if (missing.length) fail(`Faltan columnas en el CSV: ${missing.join(', ')}`);
  return lines.map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]?.trim() ?? '']));
  });
}

/** "1.234,56" → 1234.56; vacío → null */
export const num = (s) => (s ? Number(s.replace(/\./g, '').replace(',', '.')) : null);

export function fail(message) {
  console.error(message);
  process.exit(1);
}

const sql = (v) => {
  if (v == null || v === '') return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

const COLUMNS = [
  'external_id', 'name', 'category', 'packaging', 'price', 'reference_price', 'reference_format',
  'is_pack', 'image_url', 'url', 'available',
];

/**
 * Escribe supabase/imports/<store>-parte-N.sql (borra antes las partes de una importación anterior).
 * La última parte marca como no disponible lo que no venía en el fichero (no lo borra: puede tener
 * emparejamientos) y activa el súper en la app. `before` va al principio de la primera parte.
 */
export function writeImport({ storeId, products, src, minRows, before = '' }) {
  if (products.length < minRows) {
    fail(`Solo ${products.length} productos válidos: el fichero parece incompleto, no se genera nada.`);
  }
  const stamp = new Date().toISOString();
  const rows = products.map(
    (p) => `(${sql(storeId)},${COLUMNS.map((c) => sql(p[c])).join(',')},'${stamp}')`,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const partName = new RegExp(`^${storeId}-parte-\\d+\\.sql$`);
  for (const f of readdirSync(OUT_DIR)) if (partName.test(f)) rmSync(join(OUT_DIR, f));

  const parts = Math.ceil(rows.length / ROWS_PER_FILE);
  for (let i = 0; i < parts; i++) {
    let out = `-- ${storeId}, parte ${i + 1} de ${parts} (generado ${stamp} desde ${src})\n`;
    if (i === 0 && before) out += `${before}\n`;
    out +=
      `insert into public.store_products (store_id, ${COLUMNS.join(', ')}, seen_at) values\n` +
      rows.slice(i * ROWS_PER_FILE, (i + 1) * ROWS_PER_FILE).join(',\n') +
      `\non conflict (store_id, external_id) do update set\n` +
      COLUMNS.slice(1).map((c) => `  ${c} = excluded.${c}`).join(',\n') +
      `,\n  seen_at = excluded.seen_at;\n`;
    if (i === parts - 1) {
      out +=
        `\n-- Lo que no venía en este fichero ya no está en la web (no se borra: puede tener emparejamientos)\n` +
        `update public.store_products set available = false where store_id = '${storeId}' and seen_at < '${stamp}';\n` +
        `update public.stores set has_catalog = true, catalog_synced_at = '${stamp}' where id = '${storeId}';\n`;
    }
    writeFileSync(join(OUT_DIR, `${storeId}-parte-${i + 1}.sql`), out);
  }

  console.log(`${rows.length} productos → ${parts} fichero(s) en ${OUT_DIR}`);
  console.log('Ejecútalos en orden en el SQL Editor de Supabase (la última parte activa el súper en la app).');
}

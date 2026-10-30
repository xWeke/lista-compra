// Convierte el catálogo de Dia (CSV que trae el usuario) en SQL para pegar en el SQL Editor de Supabase.
//
// Dia no se vuelca solo como Mercadona y Ahorramas: su web bloquea el acceso automático y no se esquiva desde
// aquí (ver CLAUDE.md). Este script solo importa un fichero ya descargado.
//
// Uso:  npm run import:dia                         (lee ~/Downloads/dia_productos.csv)
//       npm run import:dia -- ruta\al\fichero.csv
// Salida: supabase/imports/dia-parte-N.sql (ignorado por git: son datos y caducan).
//
// CSV esperado: separador ';', coma decimal, cabecera con id;nombre;categoria;precio;precio_por_unidad;
// unidad;url;imagen (sobran columnas, se ignoran).
import { homedir } from 'node:os';
import { join } from 'node:path';

import { num, readCsv, writeImport } from './lib/catalog-sql.mjs';

const src = process.argv[2] ?? join(homedir(), 'Downloads', 'dia_productos.csv');
const csv = readCsv(
  src,
  ['id', 'nombre', 'categoria', 'precio', 'precio_por_unidad', 'unidad', 'url', 'imagen'],
  'npm run import:dia -- ruta\\al\\dia_productos.csv',
);

/** Precio por unidad de Dia → mismo formato que los demás súpers ('kg', 'L', 'ud'…), que usa lineCost. */
function reference(value, unit) {
  if (value == null || !Number.isFinite(value)) return [null, null];
  const u = unit.toLowerCase();
  if (u === 'kilo') return [value, 'kg'];
  if (u === 'litro') return [value, 'L'];
  if (u === '100 gr.') return [value * 10, 'kg'];
  if (u === '100 ml.') return [value * 10, 'L'];
  if (u === 'unidad') return [value, 'ud'];
  if (u === 'docena') return [value, 'dz'];
  return [value, u || null]; // 'lavado', 'metro'…
}

const seen = new Set();
const products = [];
for (const r of csv) {
  const price = num(r.precio);
  if (!r.id || seen.has(r.id) || price == null || !Number.isFinite(price)) continue;
  seen.add(r.id);
  const [refPrice, refFormat] = reference(num(r.precio_por_unidad), r.unidad);
  products.push({
    external_id: r.id,
    name: r.nombre,
    category: r.categoria,
    packaging: null,
    price,
    reference_price: refPrice == null ? null : Math.round(refPrice * 1000) / 1000,
    reference_format: refFormat,
    is_pack: /\bpack\b|\d+\s*x\s*\d+/i.test(r.nombre),
    image_url: r.imagen,
    url: r.url,
    available: true,
  });
}

writeImport({ storeId: 'dia', products, src, minRows: 1000 });

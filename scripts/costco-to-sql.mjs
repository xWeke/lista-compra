// Convierte el catálogo de Costco (CSV que trae el usuario) en SQL para pegar en el SQL Editor de Supabase.
//
// Costco no se vuelca solo: su tienda online (sameday.costco.es) prohíbe en robots.txt el acceso automático
// y no se automatiza desde aquí (ver CLAUDE.md). Este script solo importa un fichero ya descargado.
//
// Uso:  npm run import:costco                         (lee ~/Downloads/costco_productos.csv)
//       npm run import:costco -- ruta\al\fichero.csv
// Salida: supabase/imports/costco-parte-N.sql (ignorado por git: son datos y caducan).
//
// CSV esperado: separador ';', coma decimal, cabecera con id;nombre;categoria;formato;precio;disponible;
// url;imagen (sobran columnas, se ignoran). Costco no da precio por kg/L: se calcula del formato.
import { homedir } from 'node:os';
import { join } from 'node:path';

import { num, readCsv, writeImport } from './lib/catalog-sql.mjs';

const src = process.argv[2] ?? join(homedir(), 'Downloads', 'costco_productos.csv');
const csv = readCsv(
  src,
  ['id', 'nombre', 'categoria', 'formato', 'precio', 'disponible', 'url', 'imagen'],
  'npm run import:costco -- ruta\\al\\costco_productos.csv',
);

// Unidad del formato → [formato de referencia de la app, factor para pasar a esa unidad]
const UNITS = {
  g: ['kg', 0.001], kg: ['kg', 1], ml: ['L', 0.001], l: ['L', 1],
  unidad: ['ud', 1], ud: ['ud', 1], u: ['ud', 1], ct: ['ud', 1], each: ['ud', 1], units: ['ud', 1],
};

/**
 * Formato de Costco → precio de referencia, en las unidades que usa lineCost ('kg', 'L', 'ud').
 * "12 x 55 g" → €/kg de 660 g · "6 x 1,5 L" → €/L de 9 L · "40 unidad" → €/ud · "4,89 € / kg" (a peso) → 4,89 €/kg.
 * Lo que no se entiende ('lavados', 'm', 'sq ft'…) se queda sin referencia.
 */
function reference(format, price) {
  const perKg = format.match(/^([\d.,]+)\s*€\s*\/\s*(kg|l)$/i);
  if (perKg) return [num(perKg[1]), perKg[2].toLowerCase() === 'kg' ? 'kg' : 'L'];
  const m = format.match(/^(?:([\d.,]+)\s*x\s*)?([\d.,]+)\s*([a-z]+)$/i);
  const unit = m && UNITS[m[3].toLowerCase()];
  if (!unit) return [null, null];
  const total = (m[1] ? num(m[1]) : 1) * num(m[2]) * unit[1];
  return total > 0 ? [price / total, unit[0]] : [null, null];
}

const seen = new Set();
const products = [];
for (const r of csv) {
  const price = num(r.precio);
  if (!r.id || seen.has(r.id) || price == null || !Number.isFinite(price) || price <= 0) continue;
  seen.add(r.id);
  const [refPrice, refFormat] = reference(r.formato, price);
  // Producto a peso: el precio es el de una pieza aproximada; se muestra cuánto pesa más o menos
  const byWeight = /€/.test(r.formato);
  products.push({
    external_id: r.id,
    name: r.nombre,
    category: r.categoria,
    packaging: byWeight && refPrice ? `pieza ~${(price / refPrice).toFixed(2).replace('.', ',')} kg` : r.formato || null,
    price,
    reference_price: refPrice == null ? null : Math.round(refPrice * 1000) / 1000,
    reference_format: refFormat,
    is_pack: /\bpack\b|\d+\s*x\s*\d+/i.test(`${r.nombre} ${r.formato}`),
    image_url: r.imagen,
    url: r.url,
    available: r.disponible.toLowerCase() !== 'no',
  });
}

writeImport({
  storeId: 'costco',
  products,
  src,
  minRows: 500,
  // Costco no venía en la lista inicial de súpers
  before: `insert into public.stores (id, name, sort_order) values ('costco', 'Costco', 60) on conflict (id) do nothing;\n`,
});

// Formato de números para mostrar en pantalla (es-ES: coma decimal).

export function formatQuantity(value: number) {
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: 3 });
}

/** 23.4 → "23,40 €" */
export function formatPrice(value: number) {
  return Number(value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

/** plural(1, 'pendiente') → "1 pendiente"; plural(3, 'comprado') → "3 comprados". */
export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Cuánto suma o resta cada toque de − / + según la unidad: 0,1 kg/l; 50 g/ml; 1 para el resto. */
export function stepFor(unit: string) {
  if (unit === 'kg' || unit === 'l') return 0.1;
  if (unit === 'g' || unit === 'ml') return 50;
  return 1;
}

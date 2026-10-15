// Formato de números para mostrar en pantalla (es-ES: coma decimal).

export function formatQuantity(value: number) {
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: 3 });
}

/** plural(1, 'pendiente') → "1 pendiente"; plural(3, 'comprado') → "3 comprados". */
export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

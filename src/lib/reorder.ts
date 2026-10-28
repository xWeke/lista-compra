// Reordenar filas en la caché igual que lo hacen las funciones SQL reorder_* (sort_order = posición × 10,
// empezando en 1), para que la actualización optimista coincida con lo que devolverá el servidor.

export function sortByIds<T extends { id: string | null; sort_order: number | null }>(rows: T[], ids: string[]): T[] {
  const position = new Map(ids.map((id, i) => [id, i + 1]));
  return rows
    .map((row) => {
      const pos = row.id ? position.get(row.id) : undefined;
      return pos === undefined ? row : { ...row, sort_order: pos * 10 };
    })
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

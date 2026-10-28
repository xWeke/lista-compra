// Fila de un producto en la lista. Tocar = marcar/desmarcar; ✎ = editar.
// `byline`: línea pequeña opcional, p. ej. "Añadido por Andrea".
// `organize` (modo Organizar): en vez de casilla y ✎, un desplegable con la categoría. Es un <select> nativo:
// en el iPhone abre la ruleta del sistema, así que cambiar de categoría son dos toques.
import { formatQuantity } from '@/lib/format';

import { IconButton } from './IconButton';
import styles from './ItemRow.module.css';

export type CategoryChoice = { value: string | null; label: string };

type Props = {
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
  checked: boolean;
  byline?: string | null;
  onToggle: () => void;
  onEdit: () => void;
  organize?: {
    categoryId: string | null;
    options: CategoryChoice[];
    onChange: (categoryId: string | null) => void;
  };
};

export function ItemRow({ name, quantity, unit, note, checked, byline, onToggle, onEdit, organize }: Props) {
  const showQuantity = !(quantity === 1 && unit === 'ud');

  const texts = (
    <span className={styles.texts}>
      <span className={styles.name}>
        {name}
        {showQuantity && (
          <span className={styles.qty}>
            {formatQuantity(quantity)} {unit}
          </span>
        )}
      </span>
      {note && <span className={styles.note}>{note}</span>}
      {byline && <span className={styles.byline}>{byline}</span>}
    </span>
  );

  if (organize) {
    return (
      <li className={styles.row} data-checked={checked}>
        <span className={styles.info}>{texts}</span>
        <span className={styles.selectWrap}>
          {/* value '' = "Sin categoría" (un <option> no puede tener valor null) */}
          <select
            className={styles.select}
            aria-label={`Categoría de ${name}`}
            value={organize.categoryId ?? ''}
            onChange={(e) => organize.onChange(e.target.value || null)}>
            {organize.options.map((o) => (
              <option key={o.value ?? ''} value={o.value ?? ''}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
      </li>
    );
  }

  return (
    <li className={styles.row} data-checked={checked}>
      <button type="button" role="checkbox" aria-checked={checked} className={styles.main} onClick={onToggle}>
        <span className={styles.check} aria-hidden>
          {checked && '✓'}
        </span>
        {texts}
      </button>
      <IconButton symbol="✎" label={`Editar ${name}`} onClick={onEdit} />
    </li>
  );
}

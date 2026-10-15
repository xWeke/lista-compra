// Fila de un producto en la lista. Tocar = marcar/desmarcar; ✎ = editar.
import { formatQuantity } from '@/lib/format';

import { IconButton } from './IconButton';
import styles from './ItemRow.module.css';

type Props = {
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
};

export function ItemRow({ name, quantity, unit, note, checked, onToggle, onEdit }: Props) {
  const showQuantity = !(quantity === 1 && unit === 'ud');

  return (
    <li className={styles.row} data-checked={checked}>
      <button type="button" role="checkbox" aria-checked={checked} className={styles.main} onClick={onToggle}>
        <span className={styles.check} aria-hidden>
          {checked && '✓'}
        </span>
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
        </span>
      </button>
      <IconButton symbol="✎" label={`Editar ${name}`} onClick={onEdit} />
    </li>
  );
}

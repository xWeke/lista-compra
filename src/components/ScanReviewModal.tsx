// Revisión de lo leído en una foto antes de añadirlo: cada producto con su casilla (desmarcar = no añadir)
// y el nombre editable (por si la IA ha leído mal). "Añadir N" devuelve solo los marcados.
import { useState, type FormEvent } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';
import styles from './ScanReviewModal.module.css';

export type ReviewItem = {
  name: string;
  quantity: number;
  unit: string;
  categoryId: string | null;
  /** Texto pequeño bajo el nombre, p. ej. "2 ud · 🥛 Lácteos". */
  detail: string;
};

type Props = {
  items: ReviewItem[] | null; // null = cerrado
  onConfirm: (items: ReviewItem[]) => void;
  onClose: () => void;
};

export function ScanReviewModal({ items, onConfirm, onClose }: Props) {
  return (
    <Modal open={!!items} onClose={onClose} variant="sheet" focusFirstField={false}>
      {items && <ReviewForm initial={items} onConfirm={onConfirm} onClose={onClose} />}
    </Modal>
  );
}

function ReviewForm({ initial, onConfirm, onClose }: Omit<Props, 'items'> & { initial: ReviewItem[] }) {
  const [rows, setRows] = useState(() => initial.map((item) => ({ ...item, included: true })));
  const selected = rows.filter((r) => r.included && r.name.trim());

  const update = (index: number, changes: Partial<(typeof rows)[number]>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...changes } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (selected.length) {
      onConfirm(
        selected.map((r) => ({
          name: r.name.trim(),
          quantity: r.quantity,
          unit: r.unit,
          categoryId: r.categoryId,
          detail: r.detail,
        })),
      );
    }
  };

  return (
    <form onSubmit={submit} className={styles.form}>
      <h2 className={styles.title}>Lista leída</h2>
      {rows.length === 0 ? (
        <p className={styles.empty}>No he encontrado productos en la foto. Prueba con más luz o más cerca.</p>
      ) : (
        <>
          <p className={styles.hint}>Desmarca lo que no quieras y corrige lo que esté mal leído.</p>
          <ul className={styles.list}>
            {rows.map((row, index) => (
              <li key={index} className={styles.row} data-included={row.included}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={row.included}
                  aria-label={`Añadir ${row.name || 'producto'}`}
                  className={styles.check}
                  onClick={() => update(index, { included: !row.included })}>
                  <span className={styles.box} aria-hidden>
                    {row.included && '✓'}
                  </span>
                </button>
                <span className={styles.fields}>
                  <input
                    aria-label={`Nombre del producto ${index + 1}`}
                    autoComplete="off"
                    value={row.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                  />
                  <span className={styles.detail}>{row.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        {rows.length > 0 && (
          <Button type="submit" disabled={!selected.length}>
            Añadir {selected.length}
          </Button>
        )}
      </div>
    </form>
  );
}

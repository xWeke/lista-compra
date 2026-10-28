// Fila de un producto en la lista. Tocar = marcar/desmarcar; − / + = cantidad; ✎ = editar.
// `byline`: línea pequeña opcional, p. ej. "Añadido por Andrea".
// `organize` (modo Organizar): en vez de casilla y ✎, un desplegable con la categoría. Es un <select> nativo:
// en el iPhone abre la ruleta del sistema, así que cambiar de categoría son dos toques.
import { useEffect, useRef, useState } from 'react';

import { formatQuantity, stepFor } from '@/lib/format';

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
  /** Si se pasa (y no está comprado), salen − y + en la fila. Se llama una vez al dejar de tocar, no por cada toque. */
  onQuantityChange?: (quantity: number) => void;
  organize?: {
    categoryId: string | null;
    options: CategoryChoice[];
    onChange: (categoryId: string | null) => void;
  };
};

/** Espera tras el último toque antes de guardar: 5 toques seguidos = 1 cambio en la BD (y en el móvil del otro). */
const SAVE_DELAY_MS = 600;

/**
 * Cantidad que se está cambiando con − / + y aún no se ha guardado. `base` = la cantidad guardada cuando se
 * empezó: si la guardada cambia (se guardó la nuestra o la cambió el otro), el borrador ya no vale.
 */
type Draft = { value: number; base: number };

function useQuantityDraft(quantity: number, onSave: ((quantity: number) => void) | undefined) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Patrón de React "ajustar el estado cuando cambia una prop": se hace durante el render, sin useEffect.
  if (draft && draft.base !== quantity) setDraft(null);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<number | null>(null);
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  });

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) save.current?.(pending.current);
    pending.current = null;
  };
  // Si la fila desaparece (se sale de la lista) con un cambio sin guardar, se guarda igualmente.
  useEffect(() => flush, []);

  const change = (value: number) => {
    setDraft({ value, base: draft?.base ?? quantity });
    clearTimeout(timer.current);
    const base = draft?.base ?? quantity;
    pending.current = value === base ? null : value; // volver a la de antes = nada que guardar
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  return { value: draft?.value ?? quantity, change };
}

export function ItemRow({
  name,
  quantity,
  unit,
  note,
  checked,
  byline,
  onToggle,
  onEdit,
  onQuantityChange,
  organize,
}: Props) {
  const draft = useQuantityDraft(quantity, onQuantityChange);
  const stepper = Boolean(onQuantityChange) && !checked && !organize;
  const showQuantity = stepper || !(quantity === 1 && unit === 'ud');
  const step = stepFor(unit);
  const round = (n: number) => Math.round(n * 1000) / 1000;

  const texts = (
    <span className={styles.texts}>
      <span className={styles.name}>
        {name}
        {showQuantity && (
          // Con − / + la cantidad se ve entre los botones; aquí queda oculta, solo para lectores de pantalla
          <span className={stepper ? 'visually-hidden' : styles.qty}>
            {' '}
            {formatQuantity(draft.value)} {unit}
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
      {stepper && (
        <span className={styles.stepper} role="group" aria-label={`Cantidad de ${name}`}>
          <IconButton
            symbol="−"
            label={`Menos ${name}`}
            className={styles.stepButton}
            disabled={draft.value - step <= 0}
            onClick={() => draft.change(round(draft.value - step))}
          />
          <span className={styles.stepValue} aria-live="polite">
            {formatQuantity(draft.value)}
            {unit !== 'ud' && <span className={styles.stepUnit}> {unit}</span>}
          </span>
          <IconButton
            symbol="+"
            label={`Más ${name}`}
            className={styles.stepButton}
            onClick={() => draft.change(round(draft.value + step))}
          />
        </span>
      )}
      <IconButton symbol="✎" label={`Editar ${name}`} onClick={onEdit} />
    </li>
  );
}

// Selector de una opción en forma de "chips" (unidades, categorías…). Cada chip es un botón
// conmutable (aria-pressed): se navega con Tab como cualquier botón.
import styles from './ChipSelect.module.css';

export type ChipOption<T extends string | null> = { value: T; label: string };

type Props<T extends string | null> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string; // accesibilidad
};

export function ChipSelect<T extends string | null>({ options, value, onChange, label }: Props<T>) {
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={opt.value === value}
          className={styles.chip}
          onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

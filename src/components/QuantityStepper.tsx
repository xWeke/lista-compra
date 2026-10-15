// Control − cantidad +. El paso depende de la unidad (0,1 para kg/l; 50 para g/ml; 1 para el resto).
import { formatQuantity } from '@/lib/format';

import { IconButton } from './IconButton';
import styles from './QuantityStepper.module.css';

type Props = { value: number; unit: string; onChange: (value: number) => void; label?: string };

function stepFor(unit: string) {
  if (unit === 'kg' || unit === 'l') return 0.1;
  if (unit === 'g' || unit === 'ml') return 50;
  return 1;
}

export function QuantityStepper({ value, unit, onChange, label = 'Cantidad' }: Props) {
  const step = stepFor(unit);
  const round = (n: number) => Math.round(n * 1000) / 1000;

  return (
    <div className={styles.row} role="group" aria-label={label}>
      <IconButton symbol="−" label="Menos" onClick={() => onChange(round(value - step))} disabled={value - step <= 0} />
      <span className={styles.value}>
        {formatQuantity(value)} {unit}
      </span>
      <IconButton symbol="+" label="Más" onClick={() => onChange(round(value + step))} />
    </div>
  );
}

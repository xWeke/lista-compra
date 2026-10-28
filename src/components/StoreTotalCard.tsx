// Tarjeta "cuánto costaría la lista en este súper", enlace al detalle de precios.
import { Link } from 'react-router';

import { formatPrice, plural } from '@/lib/format';

import styles from './StoreTotalCard.module.css';

type Props = {
  storeName: string;
  total: number | null; // null = calculando
  /** Productos sin precio (no cuentan en el total). */
  missing: number;
  to: string;
};

export function StoreTotalCard({ storeName, total, missing, to }: Props) {
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.texts}>
        <span className={styles.store}>{storeName}</span>
        <span className={styles.detail}>
          {total === null ? 'Calculando…' : missing ? `${plural(missing, 'producto')} sin precio` : 'Precio estimado'}
        </span>
      </span>
      {total !== null && <span className={styles.total}>{formatPrice(total)}</span>}
      <span className={styles.chevron} aria-hidden>
        ›
      </span>
    </Link>
  );
}

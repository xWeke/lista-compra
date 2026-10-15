// Mensaje centrado para listas vacías, errores o carga.
import type { ReactNode } from 'react';

import styles from './EmptyState.module.css';

type Props = { title?: string; message?: string; loading?: boolean; children?: ReactNode };

export function EmptyState({ title, message, loading, children }: Props) {
  return (
    <div className={styles.container} role={loading ? 'status' : undefined}>
      {loading && (
        <>
          <div className={styles.spinner} aria-hidden />
          <span className="visually-hidden">Cargando…</span>
        </>
      )}
      {title && <p className={styles.title}>{title}</p>}
      {message && <p className={styles.message}>{message}</p>}
      {children}
    </div>
  );
}

// Estructura común de página: cabecera (volver, título, acciones) + contenido centrado.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './Page.module.css';

type Props = {
  title: string;
  /** Ruta a la que vuelve la flecha "‹". Sin ella no se muestra. */
  backTo?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Pie fijo abajo (p. ej. botón "+ Nueva lista"). */
  footer?: ReactNode;
};

export function Page({ title, backTo, actions, children, footer }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {backTo && (
            <Link to={backTo} className={styles.back} aria-label="Volver">
              ‹
            </Link>
          )}
          <h1 className={styles.title}>{title}</h1>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
}

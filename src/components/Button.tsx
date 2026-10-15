// Botón con variantes. `loading` lo desactiva, añade "…" al texto y avisa a lectores de pantalla (aria-busy).
// ButtonLink: mismo aspecto, pero navega (un <Link> real: admite abrir en pestaña nueva, etc.).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  compact?: boolean;
  loading?: boolean;
};

function classesFor(variant: Variant, compact?: boolean, ...extra: (string | false | undefined)[]) {
  return [styles.button, styles[variant], compact && styles.compact, ...extra].filter(Boolean).join(' ');
}

export function Button({ variant = 'primary', compact, loading, disabled, className, children, ...props }: Props) {
  return (
    <button
      type="button"
      className={classesFor(variant, compact, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}>
      {children}
      {loading && '…'}
    </button>
  );
}

type LinkProps = { to: string; variant?: Variant; compact?: boolean; children: ReactNode };

export function ButtonLink({ to, variant = 'primary', compact, children }: LinkProps) {
  return (
    <Link to={to} className={classesFor(variant, compact, styles.link)}>
      {children}
    </Link>
  );
}

// Botón pequeño con un símbolo de texto (sin librería de iconos). `label` = texto para lectores de pantalla.
import type { ButtonHTMLAttributes } from 'react';

import styles from './IconButton.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { symbol: string; label: string };

export function IconButton({ symbol, label, className, ...props }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[styles.button, className].filter(Boolean).join(' ')}
      {...props}>
      {symbol}
    </button>
  );
}

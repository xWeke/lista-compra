// Ventana modal basada en <dialog> nativo del navegador (gestiona foco, tecla Esc y fondo).
// El contenido solo se monta mientras está abierta: así un formulario dentro arranca siempre
// con sus valores iniciales (sin useEffect + setState).
import { useEffect, useRef, type ReactNode } from 'react';

import styles from './Modal.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** 'sheet' = panel que sube desde abajo (cómodo en móvil); 'center' = cuadro centrado. */
  variant?: 'center' | 'sheet';
  /** false = no poner el foco en el primer campo (en iPhone evita que salga el teclado al abrir). */
  focusFirstField?: boolean;
  children: ReactNode;
};

export function Modal({ open, onClose, variant = 'center', focusFirstField = true, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // Sincroniza la prop `open` con el estado del <dialog> (sistema externo a React).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal(); // el navegador enfoca el primer elemento enfocable
      if (!focusFirstField) dialog.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, focusFirstField]);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className={`${styles.dialog} ${styles[variant]}`}
      onClose={onClose}
      // Clic en el fondo oscuro (fuera del contenido) = cerrar.
      onClick={(e) => e.target === ref.current && onClose()}>
      {open && <div className={styles.content}>{children}</div>}
    </dialog>
  );
}

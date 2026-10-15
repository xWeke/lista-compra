// Pide un texto al usuario (crear / renombrar). Más cómodo en móvil que window.prompt.
import { useState, type FormEvent } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';
import styles from './PromptModal.module.css';

type Props = {
  open: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

export function PromptModal({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <PromptForm onClose={onClose} {...rest} />
    </Modal>
  );
}

function PromptForm({
  title,
  initialValue = '',
  placeholder,
  confirmText = 'Guardar',
  onSubmit,
  onClose,
}: Omit<Props, 'open'>) {
  const [value, setValue] = useState(initialValue);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <form onSubmit={submit} className={styles.form}>
      <h2 className={styles.title}>{title}</h2>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={title}
        name="value"
        autoComplete="off"
        // El usuario acaba de pulsar "Nueva…" o "Renombrar": va a escribir, el teclado puede abrirse.
        autoFocus
      />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!value.trim()}>
          {confirmText}
        </Button>
      </div>
    </form>
  );
}

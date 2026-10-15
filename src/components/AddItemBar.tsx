// Barra para añadir productos con autocompletado del catálogo del hogar.
import { useMemo, useRef, useState, type FormEvent } from 'react';

import styles from './AddItemBar.module.css';
import { Button } from './Button';

export type Suggestion = { id: string; name: string; normalized: string };

type Props = {
  suggestions: Suggestion[];
  /** Normaliza igual que el servidor, para comparar "platano" con "Plátano". */
  normalize: (value: string) => string;
  onAdd: (name: string) => void;
  adding?: boolean;
};

const MAX_SUGGESTIONS = 6;

export function AddItemBar({ suggestions, normalize, onAdd, adding }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = normalize(text);
    if (!q) return [];
    return suggestions
      .filter((s) => s.normalized.includes(q) && s.normalized !== q)
      .sort((a, b) => Number(!a.normalized.startsWith(q)) - Number(!b.normalized.startsWith(q)))
      .slice(0, MAX_SUGGESTIONS);
  }, [text, suggestions, normalize]);

  const add = (name: string) => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setText('');
    inputRef.current?.focus(); // seguir añadiendo sin volver a tocar el campo
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add(text);
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.row} onSubmit={submit}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Añadir producto…"
          aria-label="Producto a añadir"
          autoComplete="off"
          enterKeyHint="done"
        />
        <Button type="submit" disabled={!text.trim()} loading={adding}>
          Añadir
        </Button>
      </form>
      {matches.length > 0 && (
        <ul className={styles.suggestions}>
          {matches.map((s) => (
            <li key={s.id}>
              <button type="button" className={styles.suggestion} onClick={() => add(s.name)}>
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

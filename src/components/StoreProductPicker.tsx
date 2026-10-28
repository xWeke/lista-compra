// Elegir qué producto del súper corresponde a uno vuestro: buscador + resultados (con foto, formato y precio).
// "No lo compramos aquí" = sin equivalente en ese súper (no cuenta en el total). Sin acceso a datos:
// la página le pasa los resultados de la búsqueda.
import { useState, type FormEvent } from 'react';

import { formatPrice } from '@/lib/format';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Modal } from './Modal';
import styles from './StoreProductPicker.module.css';

export type PickerOption = {
  id: string;
  name: string;
  packaging: string | null;
  price: number;
  /** "0,96 €/L" */
  reference: string | null;
  imageUrl: string | null;
};

type Props = {
  /** null = cerrado */
  open: { productName: string; storeName: string; currentId: string | null } | null;
  /** Búsqueda que se está mostrando (la página la ejecuta) */
  results: PickerOption[] | undefined;
  loading: boolean;
  onSearch: (query: string) => void;
  onPick: (storeProductId: string | null) => void;
  onClose: () => void;
};

export function StoreProductPicker({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={!!open} onClose={onClose} variant="sheet" focusFirstField={false}>
      {open && <PickerContent {...open} {...rest} onClose={onClose} />}
    </Modal>
  );
}

function PickerContent({
  productName,
  storeName,
  currentId,
  results,
  loading,
  onSearch,
  onPick,
  onClose,
}: NonNullable<Props['open']> & Omit<Props, 'open'>) {
  const [query, setQuery] = useState(productName);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) onSearch(query);
  };

  return (
    <div className={styles.content}>
      <h2 className={styles.title}>
        {productName} en {storeName}
      </h2>
      <form onSubmit={submit} className={styles.search} role="search">
        <input
          type="search"
          aria-label={`Buscar en ${storeName}`}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={query.trim().length < 2}>
          Buscar
        </Button>
      </form>

      {loading ? (
        <EmptyState loading />
      ) : !results?.length ? (
        <EmptyState title="Sin resultados" message="Prueba con otra palabra (p. ej. la marca o el tipo)." />
      ) : (
        <ul className={styles.results} aria-label="Resultados">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={styles.option}
                aria-current={r.id === currentId || undefined}
                onClick={() => onPick(r.id)}>
                {r.imageUrl ? (
                  <img className={styles.image} src={r.imageUrl} alt="" loading="lazy" width={48} height={48} />
                ) : (
                  <span className={styles.image} />
                )}
                <span className={styles.texts}>
                  <span className={styles.name}>{r.name}</span>
                  <span className={styles.detail}>{[r.packaging, r.reference].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={styles.price}>{formatPrice(r.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => onPick(null)}>
          No lo compramos aquí
        </Button>
        <span className={styles.spacer} />
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// Panel para editar un ítem: nombre (del producto), cantidad, unidad, categoría y nota.
import { useState, type FormEvent } from 'react';

import { Button } from './Button';
import { ChipSelect, type ChipOption } from './ChipSelect';
import styles from './ItemEditModal.module.css';
import { Modal } from './Modal';
import { QuantityStepper } from './QuantityStepper';

export type ItemDraft = {
  name: string;
  quantity: number;
  unit: string;
  categoryId: string | null;
  note: string;
};

type Props = {
  initial: ItemDraft | null; // null = cerrado
  units: readonly string[];
  categories: ChipOption<string | null>[];
  onSave: (draft: ItemDraft) => void;
  onDelete: () => void;
  onClose: () => void;
};

export function ItemEditModal({ initial, onClose, ...rest }: Props) {
  return (
    <Modal open={!!initial} onClose={onClose} variant="sheet" focusFirstField={false}>
      {initial && <ItemEditForm initial={initial} onClose={onClose} {...rest} />}
    </Modal>
  );
}

function ItemEditForm({
  initial,
  units,
  categories,
  onSave,
  onDelete,
  onClose,
}: Omit<Props, 'initial'> & { initial: ItemDraft }) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft({ ...draft, [key]: value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.name.trim()) onSave(draft);
  };

  return (
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.label}>
        Producto
        <input
          name="product-name"
          autoComplete="off"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </label>

      <span className={styles.label} aria-hidden>
        Cantidad
      </span>
      <QuantityStepper label="Cantidad" value={draft.quantity} unit={draft.unit} onChange={(v) => set('quantity', v)} />
      <ChipSelect
        label="Unidad"
        options={units.map((u) => ({ value: u, label: u }))}
        value={draft.unit}
        onChange={(v) => set('unit', v)}
      />

      <span className={styles.label}>Categoría</span>
      <ChipSelect
        label="Categoría"
        options={categories}
        value={draft.categoryId}
        onChange={(v) => set('categoryId', v)}
      />

      <label className={styles.label}>
        Nota
        <textarea
          name="note"
          autoComplete="off"
          value={draft.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Marca, tamaño…"
          rows={2}
        />
      </label>

      <div className={styles.actions}>
        <Button variant="danger" onClick={onDelete}>
          Borrar
        </Button>
        <span className={styles.spacer} />
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!draft.name.trim()}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

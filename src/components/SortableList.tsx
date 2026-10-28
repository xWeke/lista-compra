// Lista que se reordena arrastrando desde el asa ≡ (librería dnd-kit). Solo el asa inicia el arrastre:
// el resto de la fila sigue desplazando la página y sus botones funcionan como siempre.
// Con teclado: tabular hasta el asa, Espacio para cogerla, ↑↓ para moverla, Espacio para soltar (Esc cancela).
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

import styles from './SortableList.module.css';

type Props<T> = {
  items: T[];
  getId: (item: T) => string;
  /** Nombre de la fila, para el asa ("Mover Lácteos") y los avisos del lector de pantalla. */
  getLabel: (item: T) => string;
  /** Ids en el orden nuevo, al soltar una fila en otra posición. */
  onReorder: (ids: string[]) => void;
  /** Clase del <li> (el aspecto de tarjeta lo pone cada página). */
  rowClassName?: string;
  /** Contenido de la fila; `handle` es el asa ≡, a colocar donde convenga (normalmente al principio). */
  renderItem: (item: T, handle: ReactNode) => ReactNode;
};

/** Las filas solo se mueven en vertical. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function SortableList<T>({ items, getId, getLabel, onReorder, rowClassName, renderItem }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const labelOf = (id: UniqueIdentifier) => {
    const item = items.find((i) => getId(i) === id);
    return item ? getLabel(item) : '';
  };
  const positionOf = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;

  // Lo que oye VoiceOver mientras arrastra (por defecto vienen en inglés).
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${labelOf(active.id)} cogido, posición ${positionOf(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)} sobre la posición ${positionOf(over.id)} de ${ids.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(active.id)} soltado en la posición ${positionOf(over.id)} de ${ids.length}.` : undefined,
    onDragCancel: ({ active }) => `Cancelado: ${labelOf(active.id)} vuelve a su sitio.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para mover: Espacio para coger, flechas arriba y abajo para desplazar, Espacio para soltar o Escape para cancelar.',
        },
      }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul>
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)} label={getLabel(item)} className={rowClassName}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

type RowProps = {
  id: string;
  label: string;
  className?: string;
  children: (handle: ReactNode) => ReactNode;
};

function SortableRow({ id, label, className, children }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={styles.handle}
      {...attributes}
      {...listeners}
      aria-label={`Mover ${label}`}>
      ≡
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}>
      {children(handle)}
    </li>
  );
}

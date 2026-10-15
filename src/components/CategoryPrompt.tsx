// Pregunta la categoría de un producto recién creado, justo debajo de la barra de añadir.
// No roba el foco: se puede seguir añadiendo productos sin contestar (o pulsar "Ahora no").
import { Button } from './Button';
import styles from './CategoryPrompt.module.css';
import { ChipSelect, type ChipOption } from './ChipSelect';

type Props = {
  productName: string;
  categories: ChipOption<string>[];
  onPick: (categoryId: string) => void;
  onDismiss: () => void;
};

export function CategoryPrompt({ productName, categories, onPick, onDismiss }: Props) {
  return (
    <div className={styles.box} role="region" aria-live="polite" aria-label={`Categoría de ${productName}`}>
      <p className={styles.question}>
        ¿Categoría de <strong>{productName}</strong>?
      </p>
      {/* value null: ningún chip marcado de inicio */}
      <ChipSelect<string | null>
        label={`Categoría de ${productName}`}
        options={categories}
        value={null}
        onChange={(id) => id && onPick(id)}
      />
      <Button variant="ghost" compact onClick={onDismiss} className={styles.dismiss}>
        Ahora no
      </Button>
    </div>
  );
}

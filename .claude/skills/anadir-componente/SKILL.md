---
name: anadir-componente
description: Crea un componente visual reutilizable en src/components/ siguiendo el estilo del proyecto (props tipadas, CSS Module con variables del tema, sin acceso a datos). Úsala cuando haga falta una pieza de UI que se use en más de un sitio o que simplifique una página.
---

# Añadir un componente

## Antes de crear

Revisar si ya existe algo en `src/components/` que sirva o se pueda ampliar con una prop: `Page`, `Button` / `ButtonLink`, `IconButton`, `ChipSelect`, `QuantityStepper`, `Modal`, `PromptModal`, `ItemEditModal`, `ItemRow`, `AddItemBar`, `EmptyState`, `RouteGuards`.

## Plantilla

`src/components/NombreComponente.tsx`:

```tsx
// <Qué es y cómo se usa, en una línea>.
import styles from './NombreComponente.module.css';

type Props = {
  title: string;
  onSelect?: () => void;
};

export function NombreComponente({ title, onSelect }: Props) {
  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      {title}
    </button>
  );
}
```

`src/components/NombreComponente.module.css`:

```css
.card {
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
```

## Reglas

- **Solo UI**: recibe datos y callbacks por props; no importa de `@/features/*` ni de `@/lib/supabase`.
- Export con nombre (`export function`). El fichero `.tsx` exporta **solo componentes**; funciones auxiliares a `src/lib/` (si no, se rompe la recarga en caliente y oxlint avisa).
- Estilos en CSS Module; colores, espacios, radios y fuentes siempre con `var(--…)` de `src/styles/global.css` (así funciona el modo oscuro). Estados por atributos (`[aria-pressed='true']`, `[data-checked='true']`) mejor que clases condicionales.
- HTML semántico: `<button type="button">` para acciones, `<a>`/`<Link>` para navegar, `<ul>/<li>` para listas, `<form onSubmit>` para formularios (Enter envía).
- Accesibilidad: `aria-label` en botones sin texto; zona táctil ≥ 38-44px; inputs con fuente ≥ 16px (zoom de Safari).
- Formularios dentro de modales: montarlos solo al abrir (ver `Modal`/`PromptModal`), nunca `useEffect` + `setState` para copiar props.
- Hover solo dentro de `@media (hover: hover)`; etiquetas invisibles con la clase global `visually-hidden`.
- Comprobar con `npm run typecheck && npm run lint` y, al terminar, revisar con la skill `revisar-ui`.

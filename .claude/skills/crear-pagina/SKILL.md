---
name: crear-pagina
description: Crea una página nueva (ruta de React Router) en Lista_Compra, protegida por login y con el estilo del proyecto. Úsala cuando el usuario pida una pantalla, página o vista nueva (p. ej. "supermercados" o "comparativa de precios").
---

# Crear una página

## Pasos

1. Crear `src/pages/<Nombre>Page.tsx` y, si necesita estilos propios, `src/pages/<Nombre>Page.module.css`.
2. Registrar la ruta en `src/router.tsx`, dentro de `children` de `<RequireAuth />` (rutas con sesión):
   ```tsx
   { path: '/supermercados', element: <StoresPage /> },
   { path: '/supermercados/:id', element: <StorePage /> },   // con parámetro → useParams()
   ```
   Rutas en español y en minúsculas (`/listas/:id`, `/categorias`). Recordar que en la URL real llevan `#`.
3. Enlazarla desde donde corresponda: `<Link to="/supermercados">` o `navigate('/supermercados')` (`useNavigate`).

## Esqueleto

```tsx
// <Qué muestra esta página y qué se puede hacer en ella>.
import { EmptyState } from '@/components/EmptyState';
import { Page } from '@/components/Page';
import { useHousehold } from '@/features/household/hooks';

import styles from './NombrePage.module.css';

export function NombrePage() {
  const householdId = useHousehold().data?.id;
  const query = useAlgo(householdId); // hook de src/features/<dominio>/hooks.ts

  return (
    <Page title="Título" backTo="/" actions={null} footer={null}>
      {query.isLoading ? (
        <EmptyState loading />
      ) : query.error ? (
        <EmptyState title="Error" message={query.error.message} />
      ) : !query.data?.length ? (
        <EmptyState title="Nada todavía" />
      ) : (
        <ul>{/* filas */}</ul>
      )}
    </Page>
  );
}
```

## Reglas

- La página **no** llama a `supabase` directamente: usa hooks de `src/features/` (si no existen, skill `anadir-feature-datos`).
- Envolver en `<Page>` (cabecera con volver/título/acciones, ancho máximo, pie fijo opcional).
- Reutilizar `src/components/` (`Button`, `IconButton`, `ChipSelect`, `Modal`, `PromptModal`, `EmptyState`...). Si falta algo reutilizable, skill `anadir-componente`.
- Estilos solo con variables de `src/styles/global.css`; nada de colores o tamaños sueltos.
- Confirmaciones con `confirm()` y errores con `notifyError()` de `@/lib/confirm`.
- Textos en español. Probar a ancho de móvil (DevTools → modo dispositivo, ~390px) y, si se puede, en el iPhone con `npm run dev -- --host`.
- Comprobar con `npm run typecheck && npm run lint && npm run build`.

# Adaptaciones de las reglas a Lista_Compra

Lista_Compra es una SPA (React + Vite, sin servidor) en **español**, usada sobre todo como PWA en **iPhone**, con
**CSS Modules** y variables de tema (no Tailwind). Estas notas tienen prioridad sobre `reglas.md`.

## Reglas que NO aplican (no reportar)

- **Hydration Safety** (toda la sección): no hay renderizado en servidor.
- **"Title Case for headings/buttons"**: en español se usa mayúscula solo inicial ("Nueva lista", "Limpiar comprados").
- **"Curly quotes"**: no reportar comillas rectas en el código; en textos visibles se aceptan "…" o « ».
- **"`&` over and"**: no se usa en español.
- **Fuentes** (`preload`, `font-display`, `preconnect`): se usan fuentes del sistema, no hay webfonts ni CDN.
- **Virtualizar listas grandes**: las listas tienen decenas de elementos, no cientos.
- **"Deep-link all stateful UI" / estado en la URL**: solo aplica a la navegación entre páginas (`#/listas/:id`). Modales de edición, el texto del buscador y similares pueden vivir en estado local.
- **"Interactive elements need keyboard handlers"**: no aplica a `<button>`, `<a>` ni `<input>` nativos (ya responden al teclado); solo a elementos no nativos con `onClick`.
- **Vídeo, GIF, `<picture>`**: no hay multimedia.

## Traducción al stack

- `focus-visible:ring-*`, `truncate`, `line-clamp-*`, `min-w-0`, `break-words`… → su equivalente en CSS
  (`:focus-visible { outline }`, `text-overflow: ellipsis`, `min-width: 0`, `overflow-wrap: anywhere`) dentro del
  `.module.css` del componente o en `src/styles/global.css`.
- Colores y medidas siempre con `var(--…)`; un color o tamaño suelto es un hallazgo.
- Confirmación de acciones destructivas: `confirm()` de `src/lib/confirm.ts` cuenta como confirmación válida.
- Números con `toLocaleString('es-ES')` o `Intl.NumberFormat` cuentan como `Intl.*`.
- "Second person": tutear al usuario ("Añade lo que haga falta comprar").
- `theme-color`: lo sincroniza `src/lib/theme.ts` (`syncThemeColor`) con `--color-header-bg`; no fijar colores a mano en `index.html` salvo los iniciales.

## Comprobaciones extra del proyecto (reportar si fallan)

- **Inputs y textareas con `font-size` ≥ 16px** (si no, Safari en iPhone hace zoom al enfocar).
- **Zonas táctiles ≥ 38px** (ideal 44px) en botones e iconos pulsables.
- **`autoFocus` en móvil**: solo donde el usuario acaba de pedir escribir (p. ej. el campo de "Nueva lista"); nunca al abrir paneles de edición.
- **Márgenes seguros**: cabecera fija y pie fijo no deben quedar bajo el notch ni la barra inferior en modo PWA.
- **Textos de usuario largos** (nombres de producto, notas, listas) no deben desbordar ni romper la fila.
- **Modo oscuro**: ningún color fijo que no tenga su variante en `:root[data-theme='dark']` (y en `[data-style='neobrutalism'][data-theme='dark']`). No usar `@media (prefers-color-scheme)` en componentes: el modo lo decide `src/lib/theme.ts` (el usuario puede forzar claro/oscuro).
- **Capas**: un componente de `src/components/` que importe de `@/features/` o `@/lib/supabase` es un hallazgo (rompe la convención de CLAUDE.md).

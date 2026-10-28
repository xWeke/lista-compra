# Lista_Compra — lista de la compra compartida

Web app (PWA) para 2 personas (pareja) con listas de la compra compartidas en tiempo real.
Se usa desde el navegador y desde el iPhone ("Añadir a pantalla de inicio"). Publicada en **GitHub Pages**.
El usuario es administrador de sistemas (domina BD e infraestructura, menos frontend): **explica las decisiones de frontend** al proponer cambios.

## Stack

- **Vite 8** + **React 19** + **TypeScript** estricto. Build = ficheros estáticos en `dist/`.
- **React Router 8** con `createHashRouter` (URLs con `#`: GitHub Pages no reescribe rutas a `index.html`).
- **CSS Modules** (`Componente.module.css`) + variables CSS de tema en `src/styles/global.css`. Claro/oscuro: el usuario elige
  Automático/Claro/Oscuro (Mis listas → Apariencia); `src/lib/theme.ts` pone `<html data-theme>` y el CSS usa `:root[data-theme='dark']`
  (nunca `@media (prefers-color-scheme)` en componentes).
- **Estilo visual "Neobrutalism"** (de typeui.sh, elegido por el usuario frente a "Colorful", que se descartó):
  bordes negros de 3px (claros en oscuro), **sombras sólidas desplazadas** (`--shadow-hard*`; amarillas en oscuro),
  **esquinas rectas** (radios a 0), cabecera y botón principal **amarillos** con texto negro, casillas cuadradas.
  Letra **Darker Grotesque** (`@fontsource-variable/darker-grotesque`, empaquetada, sin Google Fonts) también para títulos,
  en negrita 900 y mayúsculas (clase global `display`; en módulos `composes: display from global`). Es estrecha y de ojo
  pequeño: los tamaños de `--font-*` son algo mayores de lo habitual. Contraste de la paleta verificado (WCAG AA).
- **Supabase**: Postgres + Auth (email/contraseña, registro público desactivado) + Realtime. Seguridad con **RLS**.
- **TanStack Query** para caché; Realtime solo *invalida* queries (no fusiona eventos a mano).
- **dnd-kit** (`@dnd-kit/core` + `sortable`) para ordenar arrastrando, siempre a través de `components/SortableList.tsx`
  (asa ≡ con `touch-action: none`; solo el asa arrastra, así el resto de la fila sigue desplazando la página; también con teclado).
  El orden se guarda con las funciones SQL `reorder_categories` / `reorder_lists` (una transacción, `sort_order` = posición × 10).
- **vite-plugin-pwa**: manifest + service worker (`registerType: 'autoUpdate'`). Iconos en `public/` generados desde `public/icon.svg`.
- Lint con **oxlint** (`.oxlintrc.json`), formato con **Prettier** (`.prettierrc`).
- Despliegue: **GitHub Actions** (`.github/workflows/deploy.yml`) en cada push a `main`, solo si pasan lint, tipos y pruebas E2E.
- Pruebas: **Playwright + WebKit** (iPhone claro/oscuro y escritorio) con Supabase simulado (`tests/e2e/`), y **playwright-cli**
  (`@playwright/cli` fijado) para manejar el navegador. Ver skills `probar-app` y `playwright-cli`.

## Arrancar

```bash
npm install
# .env (no versionado) con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (plantilla: .env.example)
npm run dev                 # http://localhost:5173/lista-compra/
npm run dev -- --host       # accesible desde el iPhone en la misma wifi: http://<IP-del-PC>:5173/lista-compra/
npm run build && npm run preview   # probar la build de producción
```

Comprobaciones antes de dar algo por terminado:

```bash
npm run typecheck && npm run lint && npx prettier --check "src/**/*.{ts,tsx,css}" "tests/**/*.ts" && npm run build
npm run test:e2e        # pruebas E2E: SOLO cuando el usuario lo pida (~2 min); en GitHub Actions corren en cada push
```

### Supabase (CLI en devDependencies)

```bash
npx supabase login                          # una vez
npx supabase link --project-ref <ref>       # una vez
npm run db:new -- <nombre>                  # nueva migración vacía en supabase/migrations/
npm run db:push                             # aplica migraciones pendientes al proyecto remoto
npm run db:types                            # regenera src/types/database.ts desde el esquema
```

`supabase/setup_household.sql` es la **plantilla** (sin datos reales, el repo es público) del script que crea el hogar y
añade usuarios; la copia con los emails reales es `supabase/setup_household.local.sql` (ignorada por git). Se ejecuta en el SQL Editor.
Nunca subir emails, contraseñas ni claves secretas al repo.

**Red del trabajo (equipo `sistemas16`)**: bloquea el protocolo de Postgres (5432/6543 abren TCP pero no pasa tráfico) y la
API de Supabase no responde a `POST …/cli/login-role`. Por eso **desde esta red NO funcionan** `db push`, `db query --linked`
ni `migration list`. Sí funcionan (HTTPS): `gen types --linked` (`npm run db:types`), `projects list` y la API REST.
Procedimiento para aplicar una migración desde aquí:
1. El usuario pega el fichero de `supabase/migrations/` en Supabase → SQL Editor → Run.
2. Y la registra: `insert into supabase_migrations.schema_migrations (version, name) values ('<timestamp>', '<nombre>') on conflict do nothing;`
3. `npm run db:types` y `npm run typecheck`.
Desde otra red, `npm run db:push` normal. Proyecto: `wnpzgrnffjbmcpwxasgh` (eu-central-1). Hogar "Casa" creado (miembros: Adrian y Andrea).

### Despliegue (GitHub Pages)

- Repo público `lista-compra` → `https://<usuario>.github.io/lista-compra/`. El prefijo está en `base` de `vite.config.ts`.
- Secrets del repo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Settings → Pages → Source: *GitHub Actions*.
- Push a `main` = despliegue. El service worker actualiza la PWA sola al reabrirla.

## Estructura

```
index.html              Página base (meta de PWA/iPhone)
public/                 Iconos y favicon (se sirven tal cual)
src/main.tsx            Entrada: estilos globales + <App/>
src/App.tsx             Providers (TanStack Query, sesión) + RouterProvider; aviso si falta .env
src/router.tsx          Tabla de rutas (/login, /, /listas/:id, /categorias)
src/pages/              Una página por ruta. Solo componen: sin llamadas directas a Supabase
src/features/<dominio>/
  api.ts                Funciones async que hablan con Supabase (sin React)
  hooks.ts              useQuery/useMutation + useRealtimeInvalidation
src/components/         UI pura (Button, Modal, Page, ItemRow…): props tipadas, sin acceso a datos
src/lib/                supabase.ts, auth.tsx, query-client.ts (queryKeys), realtime.ts, confirm.ts, format.ts
src/styles/global.css   Variables de tema y estilos base (inputs, reset)
src/types/database.ts   Tipos GENERADOS del esquema (no editar a mano)
supabase/migrations/    SQL versionado
```

## Convenciones

- **Capas**: `pages/` → `features/*/hooks` → `features/*/api` → Supabase. Los componentes no importan de `features/` ni de `lib/supabase`.
- **Nombres**: código, tablas y columnas en inglés; textos de la UI y comentarios en español. Componentes y páginas en `PascalCase.tsx` (+ `PascalCase.module.css`); el resto en `kebab-case.ts`. Exports con nombre (no `default`).
- Alias de imports `@/` = `src/`.
- **Estilos**: nunca colores ni medidas sueltas; usar `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--font-*)`, `var(--shadow-*)`.
  Verde: `--color-primary` para rellenos (con texto blanco) y `--color-accent` para textos/iconos/foco (en oscuro son distintos). Inputs con fuente ≥ 16px (si no, Safari en iPhone hace zoom). Zonas táctiles ≥ 38-44px.
- Query keys siempre desde `queryKeys` en `src/lib/query-client.ts`.
- Mutaciones frecuentes (marcar, cantidad, borrar) **optimistas** con rollback (ver `features/items/hooks.ts`).
- Confirmaciones/errores con `confirm()` / `notifyError()` de `src/lib/confirm.ts`. Pedir texto con `PromptModal`. Modales con `Modal` (`<dialog>` nativo).
- Navegar = enlace real (`<Link>` o `ButtonLink`), nunca `onClick` + `navigate()` en un botón. Acciones = `<button>`.
- Campos sin etiqueta visible: `<label className="visually-hidden">` (utilidad global) o `aria-label`.
- Hover solo dentro de `@media (hover: hover)` (en el iPhone se queda "pegado" tras tocar). Márgenes del notch/barra de inicio: los pone `<Page>`.
- Antes de dar por buena una pantalla nueva, pasar la skill `revisar-ui`.
- No usar `setState` dentro de `useEffect` para copiar props: montar el formulario al abrir (patrón de `Modal`).
- Un fichero `.tsx` exporta solo componentes (fast refresh); helpers a `src/lib/`.

### Base de datos

- Toda tabla nueva: `household_id` (o colgar de una que lo tenga), **RLS activado** con `public.is_household_member(...)`, `grant` explícito a `authenticated`, trigger `set_updated_at` si tiene `updated_at`, índices en FKs.
- Si la app debe verla en tiempo real: `alter publication supabase_realtime add table ...` y añadirla a `RealtimeTable` en `src/lib/realtime.ts`.
- Nunca editar una migración ya aplicada: crear otra nueva.
- Tras cada migración: `npm run db:push` y `npm run db:types`.
- La app solo usa la anon/publishable key. La `service_role` **nunca** en la app, en `.env`, en secrets de GitHub ni en el repo.

### Git

- No hacer commit ni push salvo petición explícita del usuario.
- `.env` está ignorado; solo se versiona `.env.example`.

## Modelo de datos

- `households` / `household_members`: grupo que comparte (unidad de RLS). `profiles`: nombre visible (trigger al crear usuario).
- `lists`: listas del hogar. Vista `list_summaries` (security_invoker) con contadores.
- `categories`: editables, `sort_order` = orden de pasillos.
- `products`: **catálogo** del hogar ("qué es"); `name_normalized` (sin tildes/minúsculas) único por hogar; `barcode` para Fase 3.
- `list_items`: "cuánto y si ya está" en una lista. Categoría efectiva = `category_id ?? product.default_category_id`. "Limpiar comprados" rellena `archived_at` (historial, no se borra).

## Fases

1. **[EN CURSO] Lista compartida en tiempo real**: listas, añadir/editar/borrar, marcar comprado, cantidad/unidad, categorías.
2. **Precios manuales por supermercado** y comparativa del total de la lista. Diseño previsto:
   - `stores` (global: Mercadona, Lidl, Carrefour, Dia…).
   - `product_prices` (product_id, store_id, price, tamaño de envase, observed_at, `source` 'manual'|'auto') — histórico; precio vigente = último por (producto, súper).
   - Vista `list_store_totals`: total por lista y súper + nº de productos sin precio.
3. **Precios automáticos**: `store_products` (catálogo bruto descargado por súper) + `product_store_links` (emparejado por EAN/manual/fuzzy). Job (Edge Function + pg_cron, GitHub Actions programado o script propio) que vuelca a `product_prices` con `source='auto'`.

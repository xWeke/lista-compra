---
name: probar-app
description: Prueba Lista_Compra en un navegador real con Supabase simulado - ejecuta las pruebas E2E (npm run test:e2e), añade pruebas nuevas, depura fallos y explora la app con playwright-cli. Úsala cuando el usuario pida pasar las pruebas o ver la app, y para escribir/ajustar pruebas de una funcionalidad nueva. NO lanzar la batería completa tras cada cambio: solo a petición del usuario (en GitHub Actions corre en cada push).
---

# Probar la app

Las pruebas usan **Playwright con WebKit** (el motor de Safari) en tamaño iPhone 15 (claro y oscuro) y escritorio,
contra una build propia (`dist-e2e/`) con **Supabase simulado**: nunca tocan el proyecto real.
Para manejar el navegador de forma interactiva se usa la skill genérica `playwright-cli` (comando `npx playwright-cli`).

## Piezas

| Fichero | Para qué |
|---|---|
| `playwright.config.ts` | Proyectos (`iphone`, `iphone-oscuro`, `escritorio`), servidor (build + preview en el puerto 4174), Supabase falso |
| `tests/e2e/supabase-mock.ts` | Simulador de Supabase: login y PostgREST (select con `eq.`/`is.null`/`order`, insert, update, delete) sobre datos en memoria |
| `tests/e2e/fixtures.ts` | `test` con fixtures `db` (datos del simulador) y `app` (`open`, `login`, `openList`, con estilo opcional) |
| `tests/e2e/flujos.spec.ts` | Flujos: sesión, marcar, añadir, autocompletar, editar, borrar, limpiar, categorías, selector de estilo |
| `tests/e2e/auditoria.spec.ts` | Por pantalla y por estilo: zonas táctiles ≥ 38px, `touch-action`, campos con nombre, sin scroll horizontal, fuente del estilo |
| `tests/e2e/seed.spec.ts` | Semilla: deja la app con sesión y en la lista de ejemplo, para explorar con playwright-cli |

## Ejecutar

```bash
npm run test:e2e                                   # todo (3 proyectos)
npx playwright test flujos --project=iphone        # un fichero y un proyecto
npx playwright test -g "limpiar comprados"         # por nombre
npm run test:e2e:ui                                # interfaz gráfica de Playwright (para el usuario)
```

Si hay fallos: `test-results/<prueba>/` tiene captura, `error-context.md` y `trace.zip` (`npx playwright show-trace …`).
Si WebKit no está instalado: `npx playwright install webkit`.

## Explorar la app con playwright-cli

Siempre a través de la semilla (así hay Supabase simulado y sesión), nunca abriendo la URL a pelo:

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test tests/e2e/seed.spec.ts --project=iphone --debug=cli   # en segundo plano
npx playwright-cli attach tw-XXXX       # el nombre lo imprime el comando anterior
npx playwright-cli resume               # deja que la semilla termine
npx playwright-cli snapshot             # árbol de accesibilidad con refs (e12…)
npx playwright-cli click e12
npx playwright-cli screenshot --filename=captura.png
npx playwright-cli show --annotate      # el usuario marca y comenta sobre la página en vivo
```

Al terminar: cerrar la sesión de playwright-cli y parar la prueba en segundo plano.

Nota: `@playwright/cli` (0.1.x) usa su propia compilación de WebKit. Si `open --browser=webkit` dice que no está
instalado: `npx playwright-cli install-browser webkit`. Con `attach` a una prueba se usa el navegador de la prueba.

## Añadir pruebas

- Importar `test`/`expect` de `./fixtures.ts` (con extensión `.ts`).
- Localizadores **semánticos**, como un usuario: `getByRole('button', { name: 'Guardar' })`, `getByLabel('Nota')`,
  `getByRole('checkbox', { name: /Leche/ })`. Si un elemento no se puede localizar así, es un problema de accesibilidad
  de la app: arreglar la app, no la prueba.
- Comprobar también lo guardado: `await expect.poll(() => db.list_items.find(…)?.campo).toBe(…)`.
- Para casos de error, registrar una ruta **después** del simulador (`page.route(\`${SUPABASE_URL}/…\`)`): gana la última.
- Tabla o consulta nueva en la app → ampliar `supabase-mock.ts` (datos en `createSeed`, filtros si hacen falta).
- Pantalla nueva → añadirla a `auditoria.spec.ts` (se ejecuta en los dos estilos).
- Nada de `waitForTimeout` ni `networkidle`: esperar a lo que se ve (`toBeVisible`, `toHaveText`…).
- Comprobar que la prueba **puede fallar**: romper a propósito lo que vigila, verla fallar, deshacer.

## Límites

- WebKit en Windows/Linux **no es Safari de iPhone**: p. ej. no soporta `overscroll-behavior` (iOS sí) y pinta la fuente
  variable Darker Grotesque **fina** aunque pida negrita 900 (en el iPhone real se ve en negrita: confirmado). Lo que dependa
  del sistema (teclado, barra de inicio, "Añadir a pantalla de inicio") hay que verlo en el iPhone real.
- El simulador no implementa RLS ni Realtime: la seguridad se prueba contra Supabase real (ver `supabase/`).
- Las pruebas se ejecutan en GitHub Actions antes de cada despliegue; si fallan, no se publica.

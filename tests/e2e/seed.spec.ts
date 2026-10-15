// Prueba "semilla": deja la app con sesión iniciada y Supabase simulado, en la lista de ejemplo.
// No comprueba nada; sirve para explorar la app con playwright-cli (ver skill probar-app):
//   npx playwright test tests/e2e/seed.spec.ts --project=iphone --debug=cli   (en segundo plano)
//   npx playwright-cli attach tw-XXXX
import { test } from './fixtures.ts';

test('semilla: lista de ejemplo con sesión iniciada', async ({ app }) => {
  await app.openList();
});

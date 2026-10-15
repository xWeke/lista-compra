// Pruebas E2E con Playwright: la app compilada se sirve en local con un Supabase falso
// (tests/e2e/supabase-mock.ts intercepta las peticiones). Se ejecutan con `npm run test:e2e`
// y en GitHub Actions antes de cada despliegue.
import { defineConfig, devices } from '@playwright/test';

import { SUPABASE_URL } from './tests/e2e/supabase-mock.ts';

const PORT = 4174;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/lista-compra/`,
    locale: 'es-ES',
    // El service worker de la PWA podría servir peticiones sin pasar por el simulador: se bloquea.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // WebKit = el motor de Safari: lo más parecido a vuestro iPhone que se puede probar desde Windows/Linux.
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'], colorScheme: 'light' } },
    { name: 'iphone-oscuro', use: { ...devices['iPhone 15'], colorScheme: 'dark' } },
    { name: 'escritorio', use: { ...devices['Desktop Safari'], colorScheme: 'light' } },
  ],
  webServer: {
    // Build propia en dist-e2e (no pisa dist/) con claves falsas: nunca toca el Supabase real.
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/lista-compra/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: SUPABASE_URL, VITE_SUPABASE_ANON_KEY: 'clave-falsa-e2e' },
  },
});

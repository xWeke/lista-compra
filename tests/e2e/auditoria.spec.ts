// Auditoría automática de la interfaz en cada pantalla (en claro u oscuro según el proyecto). Convierte en pruebas los hallazgos de la skill revisar-ui:
// zonas táctiles ≥ 38px, sin zoom por doble toque, campos con nombre, sin scroll horizontal.
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

const MIN_TAP = 38;

async function audit(page: Page) {
  return page.evaluate((minTap) => {
    const interactive = [...document.querySelectorAll<HTMLElement>('a, button, input, textarea')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const describe = (el: HTMLElement) =>
      `${el.tagName} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 25)}"`;
    return {
      tapPequeno: interactive
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < minTap || r.height < minTap;
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`;
        }),
      sinTouchAction: interactive.filter((el) => getComputedStyle(el).touchAction !== 'manipulation').map(describe),
      camposSinNombre: [...document.querySelectorAll<HTMLInputElement>('input, textarea')]
        .filter((el) => !el.labels?.length && !el.getAttribute('aria-label'))
        .map(describe),
      scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, MIN_TAP);
}

async function expectClean(page: Page, pantalla: string) {
  const result = await audit(page);
  expect(result, `Auditoría de "${pantalla}"`).toEqual({
    tapPequeno: [],
    sinTouchAction: [],
    camposSinNombre: [],
    scrollHorizontal: false,
  });
}

test.describe('Auditoría', () => {
  test('login', async ({ app, page }) => {
    await app.open('#/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /Darker Grotesque/);
    await expectClean(page, 'Login');
  });

  test('mis listas', async ({ app, page }) => {
    await app.login();
    await expectClean(page, 'Mis listas');
  });

  test('lista y panel de edición', async ({ app, page }) => {
    await app.openList();
    await expectClean(page, 'Lista');
    await page.getByRole('button', { name: 'Editar Leche entera' }).click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    // El WebKit de Playwright para Windows no implementa overscroll-behavior (Safari en iOS sí, desde la 16):
    // solo se comprueba donde existe, y si no, queda anotado en el informe.
    if (await page.evaluate(() => CSS.supports('overscroll-behavior', 'contain'))) {
      await expect(panel).toHaveCSS('overscroll-behavior-y', 'contain');
    } else {
      test.info().annotations.push({ type: 'aviso', description: 'Este navegador no soporta overscroll-behavior' });
    }
    await expectClean(page, 'Panel de edición');
  });

  test('categorías', async ({ app, page }) => {
    await app.login();
    await page.getByRole('link', { name: 'Categorías' }).click();
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await expectClean(page, 'Categorías');
  });
});

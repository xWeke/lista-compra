// Flujos principales de la app contra Supabase simulado. Se ejecutan en cada proyecto de
// playwright.config.ts (iPhone claro, iPhone oscuro y escritorio).
import { SUPABASE_URL } from './supabase-mock.ts';
import { expect, test } from './fixtures.ts';

test.describe('Sesión', () => {
  test('sin sesión, cualquier ruta lleva al login', async ({ app, page }) => {
    await app.open('#/listas/list-1');
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('con credenciales correctas muestra las listas y sus contadores', async ({ app, page }) => {
    await app.login();
    await expect(page.getByRole('link', { name: /Compra semanal/ })).toContainText('4 pendientes · 1 comprado');
    await expect(page.getByRole('link', { name: /Farmacia/ })).toContainText('0 pendientes');
  });

  test('con credenciales incorrectas muestra el error en español', async ({ app, page }) => {
    // Se registra después del simulador: Playwright usa la última ruta que coincide.
    await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          code: 'invalid_credentials',
          message: 'Invalid login credentials',
        }),
      }),
    );
    await app.open('#/login');
    await page.getByLabel('Email').fill('yo@ejemplo.com');
    await page.getByLabel('Contraseña').fill('mala');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
  });

  test('cerrar sesión vuelve al login', async ({ app, page }) => {
    await app.login();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test.describe('Lista de la compra', () => {
  test('marcar un producto lo pasa a Comprados', async ({ app, page, db }) => {
    await app.openList();
    const platanos = page.getByRole('checkbox', { name: /Plátanos/ });
    await platanos.click();
    await expect(platanos).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('heading', { name: 'Comprados (2)' })).toBeVisible();
    await expect.poll(() => db.list_items.find((i) => i.id === 'i-platanos')?.is_checked).toBe(true);
  });

  test('añadir un producto nuevo lo crea también en el catálogo', async ({ app, page, db }) => {
    await app.openList();
    await page.getByLabel('Producto a añadir').fill('Tomates');
    await page.getByLabel('Producto a añadir').press('Enter');
    await expect(page.getByRole('checkbox', { name: /Tomates/ })).toBeVisible();
    expect(db.products.some((p) => p.name === 'Tomates')).toBe(true);
    // El campo se vacía y conserva el foco para seguir añadiendo.
    await expect(page.getByLabel('Producto a añadir')).toHaveValue('');
    await expect(page.getByLabel('Producto a añadir')).toBeFocused();
  });

  test('un producto nuevo pregunta su categoría y la guarda en el catálogo', async ({ app, page, db }) => {
    await app.openList();
    await page.getByLabel('Producto a añadir').fill('Tomates');
    await page.getByLabel('Producto a añadir').press('Enter');

    const pregunta = page.getByRole('region', { name: 'Categoría de Tomates' });
    await expect(pregunta).toBeVisible();
    // La pregunta no roba el foco: se puede seguir escribiendo el siguiente producto.
    await expect(page.getByLabel('Producto a añadir')).toBeFocused();

    await pregunta.getByRole('button', { name: /Fruta y verdura/ }).click();
    await expect(pregunta).toBeHidden();
    // Ahora aparece en la sección de su categoría…
    const seccion = page.locator('section').filter({ has: page.getByRole('heading', { name: /Fruta y verdura/ }) });
    await expect(seccion.getByRole('checkbox', { name: /Tomates/ })).toBeVisible();
    // …y queda recordada en el catálogo para la próxima vez.
    await expect.poll(() => db.products.find((p) => p.name === 'Tomates')?.default_category_id).toBe('cat-fruta');
  });

  test('"Ahora no" deja el producto nuevo en Sin categoría', async ({ app, page }) => {
    await app.openList();
    await page.getByLabel('Producto a añadir').fill('Servilletas');
    await page.getByLabel('Producto a añadir').press('Enter');
    const pregunta = page.getByRole('region', { name: 'Categoría de Servilletas' });
    await pregunta.getByRole('button', { name: 'Ahora no' }).click();
    await expect(pregunta).toBeHidden();
    const sinCategoria = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Sin categoría' }) });
    await expect(sinCategoria.getByRole('checkbox', { name: /Servilletas/ })).toBeVisible();
  });

  test('el autocompletado suma uno a un producto que ya está en la lista (sin preguntar categoría)', async ({
    app,
    page,
  }) => {
    await app.openList();
    await page.getByLabel('Producto a añadir').fill('hue');
    await page.getByRole('button', { name: 'Huevos', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /Huevos/ })).toContainText('2 ud');
    await expect(page.getByRole('region', { name: /Categoría de/ })).toHaveCount(0);
  });

  test('editar cantidad y nota desde el panel (sin abrir el teclado)', async ({ app, page, db }) => {
    await app.openList();
    await page.getByRole('button', { name: 'Editar Leche entera' }).click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    // El foco va al panel, no a un campo: en iPhone así no salta el teclado al abrir.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('DIALOG');

    await panel.getByRole('button', { name: 'Más' }).click();
    await panel.getByLabel('Nota').fill('Marca blanca');
    await panel.getByRole('button', { name: 'Guardar' }).click();

    await expect(panel).toBeHidden();
    const leche = page.getByRole('checkbox', { name: /Leche entera/ });
    await expect(leche).toContainText('7 ud');
    await expect(leche).toContainText('Marca blanca');
    await expect.poll(() => db.list_items.find((i) => i.id === 'i-leche')?.quantity).toBe(7);
  });

  test('borrar un producto pide confirmación y lo quita', async ({ app, page, db }) => {
    await app.openList();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Editar Pan de molde' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByRole('checkbox', { name: /Pan de molde/ })).toBeHidden();
    await expect.poll(() => db.list_items.some((i) => i.id === 'i-pan')).toBe(false);
  });

  test('limpiar comprados los archiva (no los borra)', async ({ app, page, db }) => {
    await app.openList();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Limpiar comprados' }).click();
    await expect(page.getByRole('heading', { name: /Comprados/ })).toBeHidden();
    await expect.poll(() => db.list_items.find((i) => i.id === 'i-lavavajillas')?.archived_at).not.toBeNull();
  });
});

test.describe('Categorías', () => {
  test('se pueden reordenar con las flechas', async ({ app, page }) => {
    await app.login();
    await page.getByRole('link', { name: 'Categorías' }).click();
    const nombres = page.getByRole('listitem');
    await expect(nombres.first()).toContainText('Fruta y verdura');
    await nombres.first().getByRole('button', { name: 'Bajar' }).click();
    await expect(nombres.first()).toContainText('Lácteos y huevos');
    await expect(nombres.nth(1)).toContainText('Fruta y verdura');
  });
});

test.describe('Apariencia', () => {
  test('el modo claro/oscuro se puede forzar, se recuerda y "Automático" sigue al sistema', async ({ app, page }) => {
    const sistema = test.info().project.use.colorScheme === 'dark' ? 'dark' : 'light';
    const html = page.locator('html');
    const modo = page.getByRole('group', { name: 'Modo claro u oscuro' });
    await app.login();
    await expect(html).toHaveAttribute('data-theme', sistema);

    await modo.getByRole('button', { name: 'Oscuro' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveCSS('color-scheme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 18, 18)'); // fondo oscuro
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await modo.getByRole('button', { name: 'Claro' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 244, 204)'); // amarillo pálido de página

    await modo.getByRole('button', { name: 'Automático' }).click();
    await expect(html).toHaveAttribute('data-theme', sistema);
  });
});

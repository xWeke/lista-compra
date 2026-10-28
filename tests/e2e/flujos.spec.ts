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

test.describe('Quién lo hizo', () => {
  test('se ve quién añadió o compró cada producto, también lo propio', async ({ app, page }) => {
    await app.openList();
    // Andrea añadió la leche y compró el lavavajillas.
    await expect(page.getByRole('checkbox', { name: /Leche entera/ })).toContainText('Añadido por Andrea');
    await expect(page.getByRole('checkbox', { name: /Lavavajillas/ })).toContainText('Comprado por Andrea');
    // Lo añadido por mí también lleva etiqueta, con mi nombre.
    await expect(page.getByRole('checkbox', { name: /Huevos/ })).toContainText('Añadido por Adrian');

    // Si lo marco yo, pasa a Comprados con mi nombre (y deja de decir "Añadido por").
    const leche = page.getByRole('checkbox', { name: /Leche entera/ });
    await leche.click();
    await expect(leche).toHaveAttribute('aria-checked', 'true');
    await expect(leche).toContainText('Comprado por Adrian');
    await expect(leche).not.toContainText('Añadido por');
  });
});

test.describe('Foto de una lista', () => {
  // PNG de 1×1 px: la app lo reduce y lo envía; la "lectura" la pone el simulador (scan_result).
  const foto = {
    name: 'lista.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  };

  test('lo leído se revisa (desmarcar, corregir) y se añade de golpe', async ({ app, page, db }) => {
    await app.openList();
    // El botón abre el selector de fotos del sistema; en la prueba se le da el fichero directamente.
    await expect(page.getByRole('button', { name: '📷 Foto' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(foto);

    const panel = page.getByRole('dialog');
    await expect(panel.getByRole('heading', { name: 'Lista leída' })).toBeVisible();
    // Producto conocido: su categoría del catálogo. Nuevo: la que propone la IA, marcado como "nuevo".
    await expect(panel.getByText('2 ud · 🥛 Lácteos y huevos')).toBeVisible();
    await expect(panel.getByText('1 kg · 🥦 Fruta y verdura · nuevo')).toBeVisible();

    await panel.getByRole('checkbox', { name: 'Añadir Garabato' }).click();
    await panel.getByLabel('Nombre del producto 2').fill('Tomates pera');
    await panel.getByRole('button', { name: 'Añadir 2' }).click();
    await expect(panel).toBeHidden();

    const fruta = page.locator('section').filter({ has: page.getByRole('heading', { name: /Fruta y verdura/ }) });
    await expect(fruta.getByRole('checkbox', { name: /Tomates pera/ })).toContainText('1 kg');
    await expect(page.getByRole('checkbox', { name: /Leche entera/ })).toContainText('8 ud'); // 6 + 2
    await expect(page.getByRole('checkbox', { name: /Garabato/ })).toHaveCount(0);
    await expect.poll(() => db.products.find((p) => p.name === 'Tomates pera')?.default_category_id).toBe('cat-fruta');
  });

  test('si la IA falla, se avisa y no se añade nada', async ({ app, page }) => {
    await app.openList();
    await page.route(`${SUPABASE_URL}/functions/v1/scan-list`, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Se ha agotado el uso gratuito de la IA por ahora. Prueba más tarde.' }),
      }),
    );
    const aviso = page.waitForEvent('dialog');
    await page.locator('input[type="file"]').setInputFiles(foto);
    const dialog = await aviso;
    expect(dialog.message()).toContain('uso gratuito');
    await dialog.accept();
    await expect(page.getByRole('heading', { name: 'Lista leída' })).toHaveCount(0);
  });
});

test.describe('Organizar', () => {
  test('el modo Organizar cambia la categoría de un producto con el desplegable y se recuerda', async ({
    app,
    page,
    db,
  }) => {
    await app.openList();
    await page.getByRole('button', { name: 'Organizar' }).click();
    // En este modo, tocar el producto no lo marca: no hay casillas ni barra de añadir.
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByLabel('Producto a añadir')).toHaveCount(0);

    await page
      .getByRole('combobox', { name: 'Categoría de Pan de molde' })
      .selectOption({ label: '🥦 Fruta y verdura' });
    const fruta = page.locator('section').filter({ has: page.getByRole('heading', { name: /Fruta y verdura/ }) });
    await expect(fruta.getByRole('combobox', { name: 'Categoría de Pan de molde' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sin categoría' })).toHaveCount(0);
    await expect.poll(() => db.products.find((p) => p.id === 'p-pan')?.default_category_id).toBe('cat-fruta');

    await page.getByRole('button', { name: 'Hecho' }).click();
    await expect(fruta.getByRole('checkbox', { name: /Pan de molde/ })).toBeVisible();
    await expect(page.getByLabel('Producto a añadir')).toBeVisible();
  });
});

test.describe('Reordenar', () => {
  test('las categorías se reordenan arrastrando el asa ≡', async ({ app, page, db }) => {
    await app.login();
    await page.getByRole('link', { name: 'Categorías' }).click();
    const filas = page.getByRole('listitem');
    await expect(filas.first()).toContainText('Fruta y verdura');
    // Arrastre en varios pasos, como un dedo, hasta un poco por encima de la primera fila: dnd-kit
    // coloca la fila en el hueco cuyo centro quede más cerca.
    const desde = (await page.getByRole('button', { name: 'Mover Limpieza' }).boundingBox())!;
    const hasta = (await page.getByRole('button', { name: 'Mover Fruta y verdura' }).boundingBox())!;
    await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2);
    await page.mouse.down();
    await page.mouse.move(hasta.x + hasta.width / 2, hasta.y - 20, { steps: 15 });
    await page.mouse.up();
    await expect(filas.first()).toContainText('Limpieza');
    await expect(filas.nth(1)).toContainText('Fruta y verdura');
    await expect
      .poll(() => [...db.categories].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map((c) => c.id))
      .toEqual(['cat-limpieza', 'cat-fruta', 'cat-lacteos']);
  });

  test('las listas se reordenan con el teclado (Espacio, flecha, Espacio)', async ({ app, page, db }) => {
    await app.login();
    const filas = page.getByRole('listitem');
    await expect(filas.first()).toContainText('Compra semanal');
    await page.getByRole('button', { name: 'Mover Farmacia' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await expect(filas.first()).toContainText('Farmacia');
    await expect.poll(() => db.lists.find((l) => l.id === 'list-2')?.sort_order).toBe(10);
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

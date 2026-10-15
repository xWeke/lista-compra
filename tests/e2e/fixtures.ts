// Fixtures comunes de las pruebas E2E: cada prueba arranca con un Supabase simulado limpio.
//   db      → "base de datos" en memoria del simulador (para comprobar qué ha guardado la app)
//   app     → utilidades: abrir la app, iniciar sesión, abrir la lista de ejemplo
import { test as base, expect, type Page } from '@playwright/test';

import { LIST_ID, USER, createSeed, mockSupabase, type MockDb } from './supabase-mock.ts';

export { expect };

class App {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Abre la app (por defecto la portada); `hash` es la ruta, p. ej. '#/login'. */
  async open(hash = '') {
    await this.page.goto(`./${hash}`);
  }

  /** Inicia sesión desde la pantalla de login y espera a ver "Mis listas". */
  async login() {
    await this.open('#/login');
    await this.page.getByLabel('Email').fill(USER.email);
    await this.page.getByLabel('Contraseña').fill('secreto');
    await this.page.getByRole('button', { name: 'Entrar' }).click();
    await expect(this.page.getByRole('link', { name: /Compra semanal/ })).toBeVisible();
  }

  /** Inicia sesión y abre la lista "Compra semanal". */
  async openList() {
    await this.login();
    await this.page.getByRole('link', { name: /Compra semanal/ }).click();
    await expect(this.page).toHaveURL(new RegExp(`#/listas/${LIST_ID}$`));
    await expect(this.page.getByRole('checkbox', { name: /Leche entera/ })).toBeVisible();
  }
}

export const test = base.extend<{ db: MockDb; app: App }>({
  db: async ({ page }, use) => {
    const db = await mockSupabase(page, createSeed());
    await use(db);
  },
  // `db` como dependencia: el simulador se instala antes de abrir la app.
  app: async ({ page, db }, use) => {
    void db;
    await use(new App(page));
  },
});

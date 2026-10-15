# Origen de esta skill

Copia literal de la skill que trae el paquete `@playwright/cli@0.1.22`
(`node_modules/playwright-core/lib/tools/skills/playwright-cli/`, playwright-core 1.64.0-alpha-1790635538000),
de Microsoft, licencia Apache-2.0 (ver `LICENSE-playwright.txt` y `NOTICE-playwright.txt`). Repositorio: https://github.com/microsoft/playwright-cli

- **No editar** `SKILL.md` ni `references/`: las particularidades de este proyecto están en la skill `probar-app`.
- **Al actualizar `@playwright/cli`** en `package.json`, volver a copiar esta carpeta desde `node_modules` (la skill
  debe corresponder a la versión instalada) y actualizar aquí la versión. Revisar el diff antes de aceptarlo.
- En este proyecto el comando se ejecuta como `npx playwright-cli …` (instalado en el proyecto, no global).
- Secciones que no aplican aquí: adjuntar capturas a pull requests y WebMCP.

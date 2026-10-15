---
name: revisar-ui
description: Revisa el código de la interfaz (componentes, páginas, CSS, index.html) contra las Web Interface Guidelines (accesibilidad, foco, formularios, uso táctil en iPhone, modo oscuro, rendimiento, textos) y lista los fallos como fichero:línea. Úsala cuando el usuario pida revisar la UI, la accesibilidad, la UX o las buenas prácticas, y antes de desplegar cambios visuales. Solo revisa; no modifica código salvo que se pida.
argument-hint: '[ficheros o carpeta; por defecto src/ e index.html]'
---

# Revisar la UI

Revisión **solo de lectura**: encuentra problemas y los lista. No cambies código salvo que el usuario lo pida después.

## Fuentes de reglas (todas locales, nada se descarga)

Leer completos, en este orden de prioridad (si chocan, manda el primero):

1. `CLAUDE.md` del proyecto (decisiones del usuario).
2. [adaptaciones.md](adaptaciones.md) — qué reglas no aplican aquí, cómo traducirlas a este stack y comprobaciones extra del proyecto.
3. [reglas.md](reglas.md) — Web Interface Guidelines de Vercel Labs, copia fijada (commit `4ecfb9f`, licencia MIT).

## Pasos

1. Determinar el alcance: los ficheros/patrones pasados como argumento o, si no hay, `src/**/*.{tsx,css}` e `index.html`.
2. Leer las tres fuentes de reglas y luego cada fichero del alcance completo (el `.tsx` junto con su `.module.css`, y `src/styles/global.css`, porque muchos estilos se heredan de ahí).
3. Comprobar cada regla aplicable. Reportar solo problemas reales con línea concreta; si algo está bien resuelto en otro fichero (p. ej. un estilo global), no es un fallo.
4. Escribir el informe en el formato de abajo.
5. Parte de estas reglas ya están automatizadas en `tests/e2e/auditoria.spec.ts` (zonas táctiles, `touch-action`,
   etiquetas, scroll horizontal). Si se detecta un problema nuevo medible, proponer añadirlo ahí (skill `probar-app`).

## Formato del informe (en español)

Agrupado por fichero, una línea por hallazgo, enlaces clicables `fichero:línea`:

```text
## src/components/Modal.tsx
src/components/Modal.tsx:12 - falta overscroll-behavior: contain en el panel
src/components/Modal.module.css:3 - ...

## src/components/Button.tsx
✓ correcto
```

Al final, un resumen breve:

- **Prioridad alta**: lo que rompe el uso en iPhone o la accesibilidad (máx. 5).
- **Mejoras**: el resto, en una línea cada una.
- **Reglas no aplicadas**: las descartadas por `adaptaciones.md` que habrían saltado, para que el usuario sepa que se omitieron a propósito.

Sin explicaciones salvo que el arreglo no sea obvio. No inventes líneas: cita solo las que hayas leído.

## Actualizar las reglas

Las reglas no se actualizan solas. Para traer una versión nueva: descargar
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`, enseñar al usuario el diff con
`reglas.md`, y solo si lo aprueba sustituir el contenido conservando la cabecera (nuevo commit y fecha).
`adaptaciones.md` no se toca al actualizar.

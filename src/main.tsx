// Punto de entrada: carga los estilos globales y monta la app en <div id="root"> de index.html.
// Fuentes empaquetadas con la app (sin Google Fonts): funcionan sin conexión en la PWA.
import '@fontsource-variable/darker-grotesque';
import '@/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { applyTheme, getThemeChoice } from '@/lib/theme';

// Antes de pintar nada, para que no se vea un parpadeo de claro a oscuro.
applyTheme(getThemeChoice());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

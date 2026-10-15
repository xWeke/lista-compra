// Punto de entrada: carga los estilos globales y monta la app en <div id="root"> de index.html.
// Fuentes empaquetadas con la app (sin Google Fonts): funcionan sin conexión en la PWA.
import '@fontsource-variable/inter';
import '@fontsource/luckiest-guy/400.css';
import '@fontsource-variable/darker-grotesque';
import '@/styles/global.css';
import '@/styles/theme-neobrutalism.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import { applyStyle, getStyle } from '@/lib/style-choice';
import { applyTheme, getThemeChoice } from '@/lib/theme';

// Antes de pintar nada, para que no se vea un parpadeo con el otro estilo.
applyStyle(getStyle());
applyTheme(getThemeChoice());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

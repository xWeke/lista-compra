// Generación de iconos de la PWA desde public/icon.svg: `npx pwa-assets-generator`.
// El icono de iPhone (apple-touch-icon) va sin margen y con fondo amarillo: iOS ya redondea las esquinas.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#ffe600' } },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: '#ffe600' } },
  },
  images: ['public/icon.svg'],
});

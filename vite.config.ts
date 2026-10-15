import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages sirve la app en https://<usuario>.github.io/lista-compra/ → todas las rutas cuelgan de ese prefijo.
// Si cambia el nombre del repo (o se usa un dominio propio), cambiar aquí.
const base = '/lista-compra/';

export default defineConfig({
  base,
  build: {
    // Un único bundle de ~600 KB (170 KB comprimido) es razonable para esta app: no hace falta trocearlo.
    chunkSizeWarningLimit: 800,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    // PWA: permite "Añadir a pantalla de inicio" en el iPhone y abrir la app a pantalla completa.
    VitePWA({
      registerType: 'autoUpdate', // al publicar una versión nueva, se actualiza sola al reabrir
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Lista de la compra',
        short_name: 'Compra',
        description: 'Lista de la compra compartida en tiempo real',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fff4cc',
        theme_color: '#fff066',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo se cachean los ficheros de la app; las llamadas a Supabase van siempre a la red.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/*latin*.woff2'], // fuentes: solo los subconjuntos latinos
      },
    }),
  ],
});

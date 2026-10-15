/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Variables de entorno (.env en local, secrets del repo en GitHub Actions).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

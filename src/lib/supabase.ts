// Cliente único de Supabase para toda la app.
// Las claves vienen de .env (variables VITE_*, que Vite incrusta en el JS al compilar).
// La anon/publishable key es pública por diseño: lo que protege los datos es RLS en la BD.
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.startsWith('https://') && anonKey.length > 0;

export const supabase = createClient<Database>(
  // URL de relleno si falta el .env: la app arranca y muestra un aviso en vez de romper.
  isSupabaseConfigured ? url : 'https://not-configured.invalid',
  isSupabaseConfigured ? anonKey : 'not-configured',
  {
    auth: {
      persistSession: true, // sesión guardada en localStorage: no hay que hacer login cada vez
      autoRefreshToken: true,
      detectSessionInUrl: false, // solo email+contraseña: no hay enlaces mágicos que leer de la URL
    },
  },
);

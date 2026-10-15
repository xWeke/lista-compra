// Raíz de la app: proveedores globales (caché de datos y sesión) + router.
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { EmptyState } from '@/components/EmptyState';
import { AuthProvider } from '@/lib/auth';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { router } from '@/router';

export function App() {
  if (!isSupabaseConfigured) {
    return (
      <EmptyState
        title="Falta configurar Supabase"
        message={'Rellena en el fichero .env:\n\nVITE_SUPABASE_URL\nVITE_SUPABASE_ANON_KEY\n\ny reinicia npm run dev.'}
      />
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Protección de rutas según haya sesión o no (se usan en src/router.tsx).
import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/lib/auth';

import { EmptyState } from './EmptyState';

/** Rutas privadas: sin sesión → /login. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <EmptyState loading />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Rutas públicas (/login): con sesión ya iniciada → a la portada. */
export function PublicOnly() {
  const { session, loading } = useAuth();
  if (loading) return <EmptyState loading />;
  return session ? <Navigate to="/" replace /> : <Outlet />;
}

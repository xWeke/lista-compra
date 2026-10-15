// Tabla de rutas. HashRouter: las URLs llevan # (…/lista-compra/#/listas/123) porque GitHub Pages
// no sabe redirigir rutas desconocidas a index.html; con # el servidor siempre sirve index.html.
import { Navigate, createHashRouter } from 'react-router';

import { PublicOnly, RequireAuth } from '@/components/RouteGuards';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ListPage } from '@/pages/ListPage';
import { ListsPage } from '@/pages/ListsPage';
import { LoginPage } from '@/pages/LoginPage';

export const router = createHashRouter([
  {
    element: <PublicOnly />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <ListsPage /> },
      { path: '/listas/:id', element: <ListPage /> },
      { path: '/categorias', element: <CategoriesPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

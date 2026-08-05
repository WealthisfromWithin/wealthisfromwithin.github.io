import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { routes } from './router';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

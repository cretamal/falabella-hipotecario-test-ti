import { Routes } from '@angular/router';

/**
 * Las rutas de la app. Cada página se carga de forma perezosa (lazy) y el comodín `**` cae en la página 404, para
 * que ninguna dirección quede en el aire.
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/catalog/catalog').then((m) => m.Catalog) },
  {
    path: 'pokemon/:name',
    loadComponent: () =>
      import('./pages/pokemon-detail/pokemon-detail').then((m) => m.PokemonDetailPage),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];

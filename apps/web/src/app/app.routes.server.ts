import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Cómo se renderiza cada ruta en el servidor: siempre SSR, y la ruta comodín responde 404 de verdad.
 */
export const serverRoutes: ServerRoute[] = [
  // Los datos cambian en cada petición (búsqueda, filtros, detalle): siempre SSR, nunca prerender, no hay otra.
  { path: '', renderMode: RenderMode.Server },
  { path: 'pokemon/:name', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];

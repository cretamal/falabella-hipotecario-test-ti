import { FetchBackend, HttpBackend } from '@angular/common/http';
import { ApplicationConfig, REQUEST_CONTEXT, inject, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { API_ORIGIN, apiOriginBackend } from './core/api-origin';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/**
 * Ajustes que solo valen para el servidor SSR: el renderizado, el origen interno del BFF y la reescritura de las rutas
 * `/api` por debajo de los interceptores.
 */
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // En el servidor las rutas "/api/…" se resuelven contra el BFF por la red interna, no por internet.
    { provide: API_ORIGIN, useFactory: () => process.env['BFF_URL'] ?? 'http://localhost:3000' },
    // Va por debajo de los interceptores (y del transfer cache): mira `apiOriginBackend` para ver por qué.
    {
      provide: HttpBackend,
      useFactory: () =>
        apiOriginBackend(
          inject(FetchBackend),
          inject(API_ORIGIN),
          (inject(REQUEST_CONTEXT, { optional: true }) as { clientIp?: string } | null)?.clientIp,
        ),
    },
  ],
};

/** La configuración final del servidor: la común más los ajustes de SSR. */
export const config = mergeApplicationConfig(appConfig, serverConfig);

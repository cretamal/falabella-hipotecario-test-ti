import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  PreloadAllModules,
  provideRouter,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { PokemonGateway } from './pokemon/application/pokemon-gateway';
import { CachedPokemonGateway } from './pokemon/infrastructure/cached-pokemon-gateway';
import { HttpPokemonGateway } from './pokemon/infrastructure/http-pokemon-gateway';
import { routes } from './app.routes';

/**
 * La configuración común (navegador y servidor): rutas, hidratación, HTTP con `fetch`, service worker (PWA) y el
 * gateway de datos. Acá, y solo acá, se elige de dónde salen los datos.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Son 3 rutas lazy diminutas: se descargan en reposo para que el clic no se quede esperando el chunk.
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Único punto donde se elige cómo se obtienen los datos: cambiar de adaptador es cambiar esta línea y nada más.
    HttpPokemonGateway,
    { provide: PokemonGateway, useClass: CachedPokemonGateway },
  ],
};

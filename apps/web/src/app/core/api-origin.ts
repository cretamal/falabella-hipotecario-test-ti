import { HttpBackend, HttpRequest } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

/**
 * El origen del BFF. En el navegador es '' (mismo origen: proxy de `ng serve` o reenvío del servidor SSR); en el
 * servidor SSR es la URL interna del BFF (ver app.config.server.ts).
 */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN', { factory: () => '' });

/**
 * Las páginas piden siempre rutas relativas ("/api/…"). En el servidor se vuelven absolutas acá, en el **backend** HTTP
 * (por debajo de todos los interceptores): así el transfer cache de Angular guarda y busca con la misma URL relativa en
 * servidor y navegador, y la hidratación no repite las peticiones. De paso reenviamos la IP real del visitante,
 * porque el límite de peticiones del BFF es por IP.
 */
export function apiOriginBackend(
  next: HttpBackend,
  origin: string,
  clientIp?: string,
): HttpBackend {
  return {
    handle: (req: HttpRequest<unknown>) =>
      next.handle(
        origin && req.url.startsWith('/api/')
          ? req.clone({
              url: origin + req.url,
              setHeaders: clientIp ? { 'x-forwarded-for': clientIp } : {},
            })
          : req,
      ),
  };
}

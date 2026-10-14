import { HttpRequest, HttpResponse, type HttpBackend } from '@angular/common/http';
import { of } from 'rxjs';
import { apiOriginBackend } from './api-origin';

/**
 * Pasa una petición por `apiOriginBackend` y devuelve la que alcanzó a llegar al backend de más abajo.
 */
function run(url: string, origin: string, clientIp?: string) {
  const seen: HttpRequest<unknown>[] = [];
  const next: HttpBackend = {
    handle: (req) => {
      seen.push(req);
      return of(new HttpResponse({ status: 200 }));
    },
  };
  apiOriginBackend(next, origin, clientIp).handle(new HttpRequest('GET', url)).subscribe();
  return seen[0];
}

describe('apiOriginBackend', () => {
  it('antepone el origen del BFF a las rutas /api y reenvía la IP del visitante', () => {
    const req = run('/api/pokemon/pikachu?lang=es', 'http://bff:3000', '203.0.113.9');
    expect(req.url).toBe('http://bff:3000/api/pokemon/pikachu?lang=es');
    expect(req.headers.get('x-forwarded-for')).toBe('203.0.113.9');
  });

  it('sin IP no añade la cabecera', () => {
    expect(run('/api/filters', 'http://bff:3000').headers.has('x-forwarded-for')).toBe(false);
  });

  it('no toca otras URLs ni actúa sin origen (navegador)', () => {
    expect(run('https://example.test/x', 'http://bff:3000').url).toBe('https://example.test/x');
    expect(run('/api/filters', '').url).toBe('/api/filters');
  });
});

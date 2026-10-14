import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CatalogQuery, EvolutionNode, Page, PokemonSummary } from '@pokedex/contracts';
import { PokemonGateway } from '../application/pokemon-gateway';
import {
  CACHE_TTL_MS,
  CachedPokemonGateway,
  DETAIL_CACHE_SIZE,
  LIST_CACHE_SIZE,
  MAX_PREFETCH,
} from './cached-pokemon-gateway';
import { HttpPokemonGateway } from './http-pokemon-gateway';

const PAGE: Page<PokemonSummary> = { items: [], total: 0, offset: 0, limit: 24 };
/** Una consulta de catálogo de mentira (24 por página). */
const query = (q?: string, offset = 0): CatalogQuery => ({ q, offset, limit: 24 });

/** Un nodo de evolución de mentira, con lo mínimo que necesita el gateway. */
const stage = (id: number, name: string, evolvesTo: EvolutionNode[] = []): EvolutionNode => ({
  id,
  name,
  label: name,
  imageUrl: '',
  conditions: [],
  evolvesTo,
});
const CHAIN = stage(172, 'pichu', [stage(25, 'pikachu', [stage(26, 'raichu')])]);

/** Arma el gateway con caché sobre un HTTP de mentira que deja revisar cada petición. */
function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HttpPokemonGateway,
      { provide: PokemonGateway, useClass: CachedPokemonGateway },
    ],
  });
  return {
    gateway: TestBed.inject(PokemonGateway),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('CachedPokemonGateway', () => {
  afterEach(() => vi.useRealTimers());

  it('repetir una consulta (aunque cambien mayúsculas, acentos o espacios) no sale a la red', () => {
    const { gateway, http } = setup();
    const results: Page<PokemonSummary>[] = [];
    gateway.list(query('Pika')).subscribe((p) => results.push(p));
    http.expectOne((r) => r.params.get('q') === 'Pika').flush(PAGE);

    gateway.list(query('  PIKA ')).subscribe((p) => results.push(p));
    gateway.list(query('pika')).subscribe((p) => results.push(p));
    http.expectNone((r) => r.url === '/api/pokemon');
    expect(results).toHaveLength(3);
  });

  it('peticiones concurrentes por la misma clave comparten una sola', () => {
    const { gateway, http } = setup();
    gateway.list(query('char')).subscribe();
    gateway.list(query('char')).subscribe();
    http.expectOne((r) => r.params.get('q') === 'char').flush(PAGE);
    http.verify();
  });

  it('consultas distintas (texto, página) sí salen a la red', () => {
    const { gateway, http } = setup();
    gateway.list(query('char')).subscribe();
    gateway.list(query('char', 24)).subscribe();
    gateway.list(query('pika')).subscribe();
    expect(http.match((r) => r.url === '/api/pokemon')).toHaveLength(3);
  });

  it('un error no se guarda: la siguiente consulta reintenta', () => {
    const { gateway, http } = setup();
    gateway.list(query('char')).subscribe({ error: () => undefined });
    http
      .expectOne((r) => r.params.get('q') === 'char')
      .flush('x', {
        status: 500,
        statusText: 'Error',
      });
    gateway.list(query('char')).subscribe();
    http.expectOne((r) => r.params.get('q') === 'char').flush(PAGE);
  });

  it('caduca por TTL', () => {
    vi.useFakeTimers();
    const { gateway, http } = setup();
    gateway.list(query('char')).subscribe();
    http.expectOne((r) => r.params.get('q') === 'char').flush(PAGE);
    vi.setSystemTime(Date.now() + CACHE_TTL_MS + 1);
    gateway.list(query('char')).subscribe();
    http.expectOne((r) => r.params.get('q') === 'char').flush(PAGE);
  });

  it('LRU: descarta la menos reciente al superar el tamaño', () => {
    const { gateway, http } = setup();
    for (let i = 0; i < LIST_CACHE_SIZE + 1; i++) {
      gateway.list(query(`n${i}x`)).subscribe();
      http.expectOne((r) => r.params.get('q') === `n${i}x`).flush(PAGE);
    }
    gateway.list(query(`n${LIST_CACHE_SIZE}x`)).subscribe(); // la más reciente: sigue en caché
    http.expectNone((r) => r.url === '/api/pokemon');
    gateway.list(query('n0x')).subscribe(); // la más antigua: expulsada
    http.expectOne((r) => r.params.get('q') === 'n0x').flush(PAGE);
  });

  it('cachea los filtros', () => {
    const { gateway, http } = setup();
    gateway.filters().subscribe();
    http.expectOne((r) => r.url === '/api/filters').flush({ types: [], generations: [] });
    gateway.filters().subscribe();
    http.expectNone((r) => r.url === '/api/filters');
  });

  describe('detalle, evolución y precarga', () => {
    /** Filtro para encontrar la petición pendiente de una URL exacta. */
    const byUrl = (url: string) => (r: { url: string }) => r.url === url;

    it('cachea el detalle y la evolución (sin distinguir mayúsculas)', () => {
      const { gateway, http } = setup();
      gateway.detail('Pikachu').subscribe();
      http.expectOne(byUrl('/api/pokemon/Pikachu')).flush({});
      gateway.detail('pikachu').subscribe();
      http.expectNone(byUrl('/api/pokemon/pikachu'));

      gateway.evolution('pikachu').subscribe();
      http.expectOne(byUrl('/api/pokemon/pikachu/evolution')).flush(CHAIN);
      gateway.evolution('PIKACHU').subscribe();
      http.expectNone(byUrl('/api/pokemon/PIKACHU/evolution'));
    });

    it('un detalle fallido no se guarda', () => {
      const { gateway, http } = setup();
      gateway.detail('eevee').subscribe({ error: () => undefined });
      http.expectOne(byUrl('/api/pokemon/eevee')).flush('x', { status: 502, statusText: 'x' });
      gateway.detail('eevee').subscribe();
      http.expectOne(byUrl('/api/pokemon/eevee')).flush({});
    });

    it('LRU del detalle: descarta el menos reciente', () => {
      const { gateway, http } = setup();
      for (let i = 0; i <= DETAIL_CACHE_SIZE; i++) {
        gateway.detail(`p${i}`).subscribe();
        http.expectOne(byUrl(`/api/pokemon/p${i}`)).flush({});
      }
      gateway.detail('p0').subscribe(); // la más antigua: expulsada
      http.expectOne(byUrl('/api/pokemon/p0')).flush({});
    });

    it('prefetchDetail pide el detalle una sola vez y luego lo sirve de la caché', () => {
      const { gateway, http } = setup();
      gateway.prefetchDetail('Eevee');
      gateway.prefetchDetail('eevee');
      http.expectOne(byUrl('/api/pokemon/eevee')).flush({});
      gateway.prefetchDetail('eevee'); // ya está cacheado: no vuelve a pedirse
      gateway.detail('eevee').subscribe(); // abrirlo no vuelve a la red
      http.expectNone((r) => r.url.startsWith('/api/pokemon/'));
    });

    it(`como máximo ${MAX_PREFETCH} precargas en vuelo; el resto espera su turno`, () => {
      const { gateway, http } = setup();
      for (const name of ['a', 'b', 'c', 'd']) gateway.prefetchDetail(name);
      const first = http.match((r) => r.url.startsWith('/api/pokemon/'));
      expect(first.map((r) => r.request.url)).toEqual(['/api/pokemon/a', '/api/pokemon/b']);
      first[0].flush({});
      const second = http.match((r) => r.url.startsWith('/api/pokemon/'));
      expect(second.map((r) => r.request.url)).toEqual(['/api/pokemon/c']);
      second[0].flush({});
      first[1].flush({});
      http.expectOne(byUrl('/api/pokemon/d')).flush({});
    });

    it('una precarga fallida no rompe nada y libera su turno', () => {
      const { gateway, http } = setup();
      gateway.prefetchDetail('a');
      http.expectOne(byUrl('/api/pokemon/a')).flush('x', { status: 502, statusText: 'x' });
      gateway.prefetchDetail('a'); // se puede volver a intentar
      http.expectOne(byUrl('/api/pokemon/a')).flush({});
    });

    it('la cadena evolutiva cargada sirve a todas sus etapas (por id y por nombre) sin red', () => {
      const { gateway, http } = setup();
      gateway.evolution('pikachu').subscribe();
      http.expectOne(byUrl('/api/pokemon/pikachu/evolution')).flush(CHAIN);
      const seen: EvolutionNode[] = [];
      for (const key of ['26', 'raichu', 172, 'Pichu']) {
        gateway.evolution(key).subscribe((root) => seen.push(root));
      }
      expect(seen).toHaveLength(4); // sincrónico: sin esperar a la red
      expect(seen.every((root) => root === seen[0])).toBe(true);
      http.expectNone((r) => r.url.endsWith('/evolution'));
    });

    it('al llegar un detalle precargado baja su artwork', () => {
      const created: { src: string }[] = [];
      vi.stubGlobal(
        'Image',
        class {
          src = '';
          /** Una imagen de mentira: solo anota cada instancia que se crea para revisar su `src`. */
          constructor() {
            created.push(this);
          }
        },
      );
      try {
        const { gateway, http } = setup();
        gateway.prefetchDetail('26');
        http.expectOne(byUrl('/api/pokemon/26')).flush({ imageUrl: 'art/26.png' });
        expect(created.map((i) => i.src)).toEqual(['art/26.png']);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('no precarga con saveData', () => {
      vi.stubGlobal('navigator', { connection: { saveData: true } });
      try {
        const { gateway, http } = setup();
        gateway.prefetchDetail('eevee');
        http.expectNone((r) => r.url.startsWith('/api/pokemon/'));
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

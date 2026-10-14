import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpPokemonGateway } from './http-pokemon-gateway';

/** Arma el gateway HTTP como si la app estuviera en el idioma `locale`. */
function setup(locale: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LOCALE_ID, useValue: locale },
      HttpPokemonGateway,
    ],
  });
  return {
    gateway: TestBed.inject(HttpPokemonGateway),
    http: TestBed.inject(HttpTestingController),
  };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('HttpPokemonGateway', () => {
  it('pide el catálogo al BFF con filtros e idioma', () => {
    const { gateway, http } = setup('es');
    gateway.list({ q: 'char', type: 'fire', generation: 1, offset: 24, limit: 24 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/pokemon');
    expect(req.request.params.toString()).toBe(
      'offset=24&limit=24&lang=es&q=char&type=fire&generation=1',
    );
    req.flush({ items: [], total: 0, offset: 24, limit: 24 });
  });

  it('omite los filtros vacíos', () => {
    const { gateway, http } = setup('es');
    gateway.list({ offset: 0, limit: 24 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/pokemon');
    expect(req.request.params.keys()).toEqual(['offset', 'limit', 'lang']);
    req.flush({});
  });

  it('usa inglés cuando el locale es en', () => {
    const { gateway, http } = setup('en');
    gateway.detail('pikachu').subscribe();
    const req = http.expectOne((r) => r.url === '/api/pokemon/pikachu');
    expect(req.request.params.get('lang')).toBe('en');
    req.flush({});
  });

  it('escapa el nombre en la ruta', () => {
    const { gateway, http } = setup('es');
    gateway.detail('a/b').subscribe();
    http.expectOne((r) => r.url === '/api/pokemon/a%2Fb').flush({});
  });

  it('pide los filtros', () => {
    const { gateway, http } = setup('es');
    gateway.filters().subscribe();
    http.expectOne((r) => r.url === '/api/filters').flush({});
  });
});

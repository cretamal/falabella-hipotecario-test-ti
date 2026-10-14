import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Page, PokemonSummary } from '@pokedex/contracts';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { FakeGateway, summary } from '../../../../test-support/fakes';
import { NavigationHint } from '../../core/navigation-hint';
import { PokemonGateway } from '../../pokemon/application/pokemon-gateway';
import { Catalog } from './catalog';

/** Una página vacía que hace de destino cuando el test navega al detalle. */
@Component({ template: '' })
class Destination {}

/**
 * Abre el catálogo en la URL dada con un gateway de mentira (que el test puede ajustar) y espera a que termine de pintar.
 */
async function open(url: string, configure?: (gateway: FakeGateway) => void) {
  const gateway = new FakeGateway();
  configure?.(gateway);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Catalog },
        { path: 'pokemon/:name', component: Destination },
      ]),
      { provide: PokemonGateway, useValue: gateway },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  harness.detectChanges();
  const el = harness.routeNativeElement as HTMLElement;
  return { harness, gateway, el, text: () => el.textContent ?? '' };
}

describe('Catalog', () => {
  it('lee la URL, consulta la API y pinta las tarjetas', async () => {
    const { gateway, el, text } = await open('/?q=char&type=fire&gen=1&page=2');
    expect(gateway.queries.at(-1)).toEqual({
      q: 'char',
      type: 'fire',
      generation: 1,
      offset: 24,
      limit: 24,
    });
    expect(el.querySelectorAll('app-pokemon-card')).toHaveLength(2);
    expect(text()).toContain('Charmander');
    expect(text()).toContain('2');
    expect((el.querySelector('#search') as HTMLInputElement).value).toBe('char');
  });

  it('refleja filtros activos en los selects y ofrece limpiarlos', async () => {
    const { el } = await open('/?type=water&gen=1');
    expect((el.querySelector('#type option:checked') as HTMLOptionElement).value).toBe('water');
    expect((el.querySelector('#generation option:checked') as HTMLOptionElement).value).toBe('1');
    expect(el.textContent).toContain('Limpiar filtros');
  });

  it('muestra el estado vacío', async () => {
    const { text, el } = await open('/?q=zzz', (g) => {
      g.listImpl = (q) => of({ items: [], total: 0, offset: q.offset, limit: q.limit });
    });
    expect(text()).toContain('Sin resultados');
    expect(el.querySelectorAll('app-pokemon-card')).toHaveLength(0);
  });

  it('avisa cuando la página pedida no existe', async () => {
    const { text } = await open('/?page=99', (g) => {
      g.listImpl = (q) => of({ items: [], total: 50, offset: q.offset, limit: q.limit });
    });
    expect(text()).toContain('Esta página no existe');
  });

  it('muestra el error y reintenta', async () => {
    let fail = true;
    const { harness, gateway, el } = await open('/', (g) => {
      g.listImpl = (q) =>
        fail
          ? throwError(() => new Error('boom'))
          : of({ items: [summary(25, 'pikachu')], total: 1, offset: q.offset, limit: q.limit });
    });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();

    fail = false;
    (
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Reintentar'),
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(gateway.queries).toHaveLength(2);
    expect(el.querySelectorAll('app-pokemon-card')).toHaveLength(1);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('muestra el esqueleto mientras carga', async () => {
    const { el } = await open('/', (g) => (g.listImpl = () => NEVER));
    expect(el.querySelectorAll('app-skeleton').length).toBeGreaterThan(0);
  });

  it('la búsqueda se vuelve parámetro de URL tras el debounce y reinicia la página', async () => {
    const { harness, gateway, el } = await open('/?page=3');
    const input = el.querySelector('#search') as HTMLInputElement;
    input.value = 'pika';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/?q=pika');
    expect(gateway.queries.at(-1)).toMatchObject({ q: 'pika', offset: 0 });
  });

  it('conserva los resultados anteriores (atenuados) mientras llega una nueva búsqueda', async () => {
    const pending = new Subject<Page<PokemonSummary>>();
    let calls = 0;
    const { harness, el, text } = await open('/', (g) => {
      g.listImpl = (q) =>
        ++calls === 1
          ? of({ items: [summary(25, 'pikachu')], total: 1, offset: q.offset, limit: q.limit })
          : pending;
    });
    await TestBed.inject(Router).navigate([], { queryParams: { q: 'char' } });
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(el.querySelectorAll('app-skeleton')).toHaveLength(0);
    expect(el.querySelectorAll('app-pokemon-card')).toHaveLength(1);
    expect(el.querySelector('ul.grid')?.getAttribute('aria-busy')).toBe('true');
    expect(text()).toContain('Buscando');

    pending.next({ items: [summary(4, 'charmander')], total: 1, offset: 0, limit: 24 });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('ul.grid')?.getAttribute('aria-busy')).toBeNull();
    expect(text()).toContain('Charmander');
    expect(text()).not.toContain('Buscando');
  });

  it('avisa cuando los resultados son aproximados', async () => {
    const { text } = await open('/?q=pikchu', (g) => {
      g.listImpl = (q) =>
        of({
          items: [summary(25, 'pikachu')],
          total: 1,
          offset: q.offset,
          limit: q.limit,
          fuzzy: true as const,
        });
    });
    expect(text()).toContain('Sin coincidencias exactas para «pikchu»');
  });

  it('no muestra el aviso con resultados exactos', async () => {
    const { text } = await open('/?q=pika');
    expect(text()).not.toContain('Sin coincidencias exactas');
  });

  it('al abrir una tarjeta guarda su resumen para que la ficha pinte al instante', async () => {
    const { el } = await open('/');
    el.querySelector<HTMLElement>('.card')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(TestBed.inject(NavigationHint).take('charmander')?.id).toBe(4);
  });

  it('la intención de abrir una tarjeta precarga su detalle', async () => {
    const { gateway, el } = await open('/');
    el.querySelector<HTMLElement>('.card')!.dispatchEvent(new Event('touchstart'));
    expect(gateway.prefetched).toEqual(['charmander']);
  });
});

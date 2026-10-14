import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { NavigationHint } from '../../core/navigation-hint';
import { EVOLUTION, FakeGateway, summary } from '../../../../test-support/fakes';
import { PokemonGateway } from '../../pokemon/application/pokemon-gateway';
import { PokemonDetailPage } from './pokemon-detail';

/**
 * Abre la ficha de Pikachu con un gateway de mentira. Permite simular SSR (`platform`), el estado de la respuesta y la
 * cabecera optimista.
 */
async function open(
  configure?: (gateway: FakeGateway) => void,
  responseInit?: ResponseInit,
  platform = 'browser',
  hint?: ReturnType<typeof summary>,
) {
  const gateway = new FakeGateway();
  configure?.(gateway);
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platform },
      provideRouter([{ path: 'pokemon/:name', component: PokemonDetailPage }]),
      { provide: PokemonGateway, useValue: gateway },
      ...(responseInit ? [{ provide: RESPONSE_INIT, useValue: responseInit }] : []),
    ],
  });
  if (hint) TestBed.inject(NavigationHint).set(hint);
  const harness = await RouterTestingHarness.create('/pokemon/pikachu');
  await harness.fixture.whenStable();
  harness.detectChanges();
  return { harness, gateway, el: harness.routeNativeElement as HTMLElement };
}

describe('PokemonDetailPage', () => {
  it('muestra la ficha completa', async () => {
    const { el } = await open();
    const text = el.textContent ?? '';
    expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
    expect(text).toContain('#025');
    expect(text).toContain('Pokémon Ratón');
    expect(text).toContain('Eléctrico');
    expect(text).toContain('Descripción de prueba.');
    expect(text).toContain('Generación I');
    expect(text).toMatch(/0[,.]4\s*m/);
    expect(text).toMatch(/6[,.]0\s*kg/);
    expect(text).toContain('Pararrayos');
    expect(text).toContain('oculta');
    expect(el.querySelectorAll('app-stat-bar')).toHaveLength(2);
    expect(text).toContain('125'); // suma de las estadísticas base
  });

  it('resalta la etapa actual de la cadena evolutiva (enlaces accesibles)', async () => {
    const { el } = await open();
    const stages = Array.from(el.querySelectorAll('div.stage'));
    expect(stages.map((s) => s.textContent?.trim())).toEqual(['Pichu', 'Pikachu', 'Raichu']);
    expect(stages.map((s) => s.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    expect(stages.every((s) => s.getAttribute('role') === 'link')).toBe(true);
    expect(el.textContent).toContain('Amistad 220');
    expect(el.textContent).toContain('Piedra Trueno');
  });

  it('404: muestra "no encontrado" y fija el status del SSR', async () => {
    const responseInit: ResponseInit = { status: 200 };
    const { el } = await open(
      (g) => (g.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 404 }))),
      responseInit,
    );
    expect(el.textContent).toContain('Pokémon no encontrado');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(responseInit.status).toBe(404);
  });

  it('otros errores: alerta con "Reintentar" y sin tocar el status', async () => {
    const responseInit: ResponseInit = { status: 200 };
    const { el } = await open(
      (g) => (g.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 502 }))),
      responseInit,
    );
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain('Reintentar');
    expect(responseInit.status).toBe(200);
  });

  it('indica la carga', async () => {
    const { el } = await open((g) => (g.detailImpl = () => NEVER));
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando');
  });

  describe('evolución independiente del detalle', () => {
    it('el contenido principal no espera a la evolución, que muestra su marcador', async () => {
      const { el } = await open((g) => (g.evolutionImpl = () => NEVER));
      expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
      expect(el.querySelectorAll('app-stat-bar')).toHaveLength(2);
      expect(el.querySelector('app-evolution-panel app-skeleton')).not.toBeNull();
      expect(el.querySelector('app-evolution-tree')).toBeNull();
    });

    it('llega después y se pinta sin tocar el resto', async () => {
      const pending = new Subject<typeof EVOLUTION>();
      const { harness, el } = await open((g) => (g.evolutionImpl = () => pending));
      pending.next(EVOLUTION);
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(el.querySelector('app-evolution-tree')).not.toBeNull();
      expect(el.querySelector('app-evolution-panel app-skeleton')).toBeNull();
    });

    it('si falla, ofrece reintentar solo la evolución', async () => {
      let fail = true;
      const { harness, gateway, el } = await open((g) => {
        g.evolutionImpl = () => (fail ? throwError(() => new Error('boom')) : of(EVOLUTION));
      });
      expect(el.querySelector('app-evolution-panel [role="alert"]')).not.toBeNull();
      expect(el.querySelector('h1')?.textContent).toBe('Pikachu'); // el detalle sigue ahí
      let detailCalls = 0;
      const original = gateway.detailImpl;
      gateway.detailImpl = (n) => {
        detailCalls++;
        return original(n);
      };

      fail = false;
      el.querySelector<HTMLButtonElement>('app-evolution-panel button')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(el.querySelector('app-evolution-tree')).not.toBeNull();
      expect(detailCalls).toBe(0);
    });

    it('con la evolución cargada precarga en reposo las etapas cercanas, nunca la actual', async () => {
      vi.useFakeTimers();
      try {
        const { gateway } = await open();
        expect(gateway.prefetched).toEqual([]); // espera a que el navegador esté en reposo
        await vi.advanceTimersByTimeAsync(2100);
        expect(gateway.prefetched).toEqual(['172', '26']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('en el servidor no precarga nada', async () => {
      vi.useFakeTimers();
      try {
        const { gateway } = await open(undefined, undefined, 'server');
        await vi.advanceTimersByTimeAsync(2100);
        expect(gateway.prefetched).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('la intención sobre una etapa precarga su detalle', async () => {
      const { harness, gateway, el } = await open();
      const stage = el.querySelector('app-evolution-tree div.stage')!;
      vi.useFakeTimers();
      try {
        stage.dispatchEvent(new Event('touchstart'));
        harness.detectChanges();
        expect(gateway.prefetched).toContain('172');
      } finally {
        vi.useRealTimers();
      }
    });

    it('en el servidor no pide la evolución (el HTML trae el marcador)', async () => {
      let calls = 0;
      const { el } = await open(
        (g) => {
          g.evolutionImpl = () => {
            calls++;
            return of(EVOLUTION);
          };
        },
        undefined,
        'server',
      );
      expect(calls).toBe(0);
      expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
      expect(el.querySelector('app-evolution-panel app-skeleton')).not.toBeNull();
    });
  });

  describe('navegación optimista', () => {
    it('mientras carga el detalle, pinta la cabecera con el resumen del catálogo', async () => {
      const { el } = await open(
        (g) => (g.detailImpl = () => NEVER),
        undefined,
        'browser',
        summary(25, 'pikachu', 'electric'),
      );
      expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
      expect(el.textContent).toContain('#025');
      expect(el.querySelector('app-stat-bar')).toBeNull(); // el resto sigue cargando
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando');
    });

    it('un resumen de otro Pokémon no se usa', async () => {
      const { el } = await open(
        (g) => (g.detailImpl = () => NEVER),
        undefined,
        'browser',
        summary(1, 'bulbasaur'),
      );
      expect(el.querySelector('h1')).toBeNull();
    });
  });
});

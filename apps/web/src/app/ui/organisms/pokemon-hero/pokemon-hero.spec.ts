import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DETAIL, summary } from '../../../../../test-support/fakes';
import { PokemonHero } from './pokemon-hero';

/** El componente anfitrión: la cabecera con contenido proyectado en la ranura lateral. */
@Component({
  imports: [PokemonHero],
  template: `<app-pokemon-hero [pokemon]="pokemon" [summary]="summary"
    ><p heroAside class="lado">evolución</p></app-pokemon-hero
  >`,
})
class Host {
  pokemon: typeof DETAIL | undefined = DETAIL;
  summary: ReturnType<typeof summary> | undefined;
}

/** Pinta la cabecera con los inputs indicados. */
function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(PokemonHero);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PokemonHero (organismo)', () => {
  it('con el detalle muestra todo y usa la miniatura como marcador del artwork', () => {
    const el = render({ pokemon: DETAIL });
    expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
    expect(el.textContent).toContain('Pokémon Ratón');
    expect(el.querySelector('img.thumb')?.getAttribute('src')).toBe(DETAIL.thumbUrl);
  });

  it('con solo el resumen (navegación optimista) pinta número, nombre, tipos e imagen; el resto, marcadores', () => {
    const el = render({ summary: summary(25, 'pikachu', 'electric') });
    expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
    expect(el.textContent).toContain('#025');
    expect(el.querySelector('app-type-chip')).not.toBeNull();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://img.test/25.png');
    expect(el.querySelectorAll('app-skeleton').length).toBeGreaterThan(0);
  });

  it('el detalle manda sobre el resumen', () => {
    const el = render({ pokemon: DETAIL, summary: summary(1, 'bulbasaur') });
    expect(el.querySelector('h1')?.textContent).toBe('Pikachu');
  });

  it('sin datos muestra solo marcadores (sin h1)', () => {
    const el = render({});
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelectorAll('app-skeleton').length).toBeGreaterThan(0);
  });

  describe('ranura lateral [heroAside]', () => {
    /** Pinta el anfitrión con el Pokémon y el resumen indicados. */
    const host = (pokemon: typeof DETAIL | undefined, sum?: ReturnType<typeof summary>) => {
      const fixture = TestBed.createComponent(Host);
      fixture.componentInstance.pokemon = pokemon;
      fixture.componentInstance.summary = sum;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('aloja el contenido proyectado dentro de la cabecera, con el detalle', () => {
      const el = host(DETAIL);
      expect(el.querySelector('.hero > .lado')?.textContent).toBe('evolución');
    });

    it('también con solo el resumen (navegación optimista)', () => {
      const el = host(undefined, summary(25, 'pikachu'));
      expect(el.querySelector('.hero > .lado')).not.toBeNull();
    });

    it('sin datos muestra su propio marcador lateral en vez del contenido proyectado', () => {
      const el = host(undefined);
      expect(el.querySelector('.lado')).toBeNull();
      expect(el.querySelectorAll('.aside-skeleton app-skeleton')).toHaveLength(3);
    });
  });
});

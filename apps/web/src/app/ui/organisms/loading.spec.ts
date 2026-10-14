import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PokemonCard } from '../molecules/pokemon-card/pokemon-card';
import { EvolutionPanel } from './evolution-panel/evolution-panel';
import { PokemonAbout } from './pokemon-about/pokemon-about';
import { PokemonHero } from './pokemon-hero/pokemon-hero';
import { StatsPanel } from './stats-panel/stats-panel';

/** Sin datos, cada componente que depende de datos externos pinta su marcador de carga. */
describe.each<[string, Type<unknown>]>([
  ['PokemonCard', PokemonCard],
  ['PokemonHero', PokemonHero],
  ['PokemonAbout', PokemonAbout],
  ['StatsPanel', StatsPanel],
  ['EvolutionPanel', EvolutionPanel],
])('estado de carga: %s', (_name, component) => {
  it('muestra marcadores y ningún texto de datos', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-skeleton').length).toBeGreaterThan(0);
    expect(el.querySelector('h1, .name, meter, app-stat-bar')).toBeNull();
  });
});

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { summary } from '../../../../../test-support/fakes';
import { PokemonGrid } from './pokemon-grid';

/** Una página vacía que hace de destino al abrir una tarjeta. */
@Component({ template: '' })
class Destination {}

/** Pinta la grilla con los inputs indicados y un router de prueba. */
function render(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'pokemon/:name', component: Destination }])],
  });
  const fixture = TestBed.createComponent(PokemonGrid);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PokemonGrid (organismo)', () => {
  it('muestra una tarjeta por Pokémon dentro de una lista', () => {
    const el = render({ items: [summary(4, 'charmander'), summary(6, 'charizard')] });
    expect(el.querySelectorAll('ul[role="list"] > li app-pokemon-card')).toHaveLength(2);
    expect(el.querySelectorAll('app-skeleton')).toHaveLength(0);
  });

  it('en carga muestra marcadores y ninguna tarjeta', () => {
    const el = render({ loading: true, skeletonCount: 5, items: [summary(4, 'charmander')] });
    expect(el.querySelectorAll('app-pokemon-card app-skeleton').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('app-pokemon-card')).toHaveLength(5);
    expect(el.querySelector('.name')).toBeNull();
  });

  it('reenvía la selección y la intención de sus tarjetas', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'pokemon/:name', component: Destination }])],
    });
    const fixture = TestBed.createComponent(PokemonGrid);
    fixture.componentRef.setInput('items', [summary(4, 'charmander')]);
    fixture.detectChanges();
    const selected: string[] = [];
    const intent: string[] = [];
    fixture.componentInstance.selected.subscribe((s) => selected.push(s.name));
    fixture.componentInstance.intent.subscribe((n) => intent.push(n));
    const card = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.card')!;
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card.dispatchEvent(new Event('touchstart'));
    expect(selected).toEqual(['charmander']);
    expect(intent).toEqual(['charmander']);
  });
});

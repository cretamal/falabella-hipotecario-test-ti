import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PokemonSummary } from '@pokedex/contracts';
import { summary } from '../../../../../test-support/fakes';
import { INTENT_DELAY_MS, PokemonCard } from './pokemon-card';

/** Una página vacía que hace de destino al abrir la tarjeta. */
@Component({ template: '' })
class Destination {}

/** Crea la tarjeta (con el Pokémon dado, o cargando si no hay) y anota los eventos que emite. */
function create(pokemon?: PokemonSummary) {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'pokemon/:name', component: Destination }])],
  });
  const fixture = TestBed.createComponent(PokemonCard);
  if (pokemon) fixture.componentRef.setInput('pokemon', pokemon);
  fixture.detectChanges();
  const card = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.card')!;
  const events = { selected: [] as PokemonSummary[], intent: [] as string[] };
  fixture.componentInstance.selected.subscribe((v) => events.selected.push(v));
  fixture.componentInstance.intent.subscribe((v) => events.intent.push(v));
  return { fixture, card, events };
}

describe('PokemonCard (molécula)', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra número, nombre y tipos', () => {
    const { card } = create(summary(4, 'charmander'));
    expect(card.textContent).toContain('#004');
    expect(card.textContent).toContain('Charmander');
  });

  it('emite selected con el resumen al hacer clic y con Enter', () => {
    const { card, events } = create(summary(4, 'charmander'));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(events.selected.map((s) => s.name)).toEqual(['charmander', 'charmander']);
  });

  it('emite intent tras mantener el cursor o el foco, no antes', () => {
    vi.useFakeTimers();
    const { card, events } = create(summary(4, 'charmander'));
    card.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(INTENT_DELAY_MS - 1);
    expect(events.intent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events.intent).toEqual(['charmander']);

    card.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(events.intent).toEqual(['charmander', 'charmander']);
  });

  it('salir antes del retardo cancela la intención', () => {
    vi.useFakeTimers();
    const { card, events } = create(summary(4, 'charmander'));
    card.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(INTENT_DELAY_MS - 10);
    card.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(1000);
    expect(events.intent).toEqual([]);
  });

  it('el toque no espera', () => {
    vi.useFakeTimers();
    const { card, events } = create(summary(4, 'charmander'));
    card.dispatchEvent(new Event('touchstart'));
    expect(events.intent).toEqual(['charmander']);
  });

  it('destruir la tarjeta cancela la intención pendiente', () => {
    vi.useFakeTimers();
    const { fixture, card, events } = create(summary(4, 'charmander'));
    card.dispatchEvent(new Event('pointerenter'));
    fixture.destroy();
    vi.advanceTimersByTime(1000);
    expect(events.intent).toEqual([]);
  });

  it('en carga (sin datos) no emite nada', () => {
    const { fixture, events } = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-skeleton')).not.toBeNull();
    expect(events.selected).toEqual([]);
  });
});

import { TestBed } from '@angular/core/testing';
import { summary } from '../../../test-support/fakes';
import { NavigationHint } from './navigation-hint';

describe('NavigationHint', () => {
  it('entrega el resumen una sola vez y solo para el Pokémon abierto', () => {
    const hint = TestBed.inject(NavigationHint);
    hint.set(summary(25, 'pikachu'));
    expect(hint.take('pikachu')?.id).toBe(25);
    expect(hint.take('pikachu')).toBeNull();
  });

  it('descarta un resumen de otro Pokémon', () => {
    const hint = TestBed.inject(NavigationHint);
    hint.set(summary(25, 'pikachu'));
    expect(hint.take('eevee')).toBeNull();
    expect(hint.take('pikachu')).toBeNull(); // ya se consumió: no se entrega dos veces
  });
});

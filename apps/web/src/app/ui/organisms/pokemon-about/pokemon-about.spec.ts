import { TestBed } from '@angular/core/testing';
import { DETAIL } from '../../../../../test-support/fakes';
import { PokemonAbout } from './pokemon-about';

/** Crea el panel con el Pokémon dado (o cargando si no hay). */
function create(pokemon?: typeof DETAIL) {
  const fixture = TestBed.createComponent(PokemonAbout);
  if (pokemon) fixture.componentRef.setInput('pokemon', pokemon);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PokemonAbout (organismo)', () => {
  it('muestra descripción, altura, peso y habilidades como chips', () => {
    const el = create(DETAIL);
    expect(el.querySelector('.description')?.textContent).toContain('Descripción de prueba.');
    const terms = Array.from(el.querySelectorAll('dt')).map((t) => t.textContent?.trim());
    expect(terms).toEqual(['Altura', 'Peso', 'Habilidades']);
    expect(el.querySelectorAll('li.chip')).toHaveLength(2);
  });

  it('la habilidad oculta lleva icono y texto accesible; la normal no', () => {
    const chips = Array.from(create(DETAIL).querySelectorAll('li.chip'));
    const hidden = chips.filter((c) => c.classList.contains('hidden'));
    expect(hidden).toHaveLength(1);
    expect(hidden[0].querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(hidden[0].querySelector('.visually-hidden')?.textContent).toContain('oculta');
    expect(chips.find((c) => !c.classList.contains('hidden'))!.querySelector('svg')).toBeNull();
  });

  it('sin descripción los datos ocupan todo el ancho', () => {
    const el = create({ ...DETAIL, description: '' });
    expect(el.querySelector('.description')).toBeNull();
    expect(el.querySelector('.about')?.classList).toContain('solo');
  });

  it('sin datos: marcadores con las mismas zonas', () => {
    const el = create();
    expect(el.querySelector('.about .description')).not.toBeNull();
    expect(el.querySelectorAll('.facts app-skeleton')).toHaveLength(3);
    expect(el.querySelector('dl')).toBeNull();
  });
});

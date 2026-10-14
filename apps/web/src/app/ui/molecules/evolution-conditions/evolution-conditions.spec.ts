import { TestBed } from '@angular/core/testing';
import { EvolutionConditions } from './evolution-conditions';

/** Crea el componente para «Leafeon» con las condiciones que le pasemos. */
function create(items: string[]) {
  const fixture = TestBed.createComponent(EvolutionConditions);
  fixture.componentRef.setInput('label', 'Leafeon');
  fixture.componentRef.setInput('items', items);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  /** Los textos de las condiciones que se ven en pantalla. */
  const conditions = () =>
    Array.from(el.querySelectorAll('.condition')).map((c) => c.textContent?.trim());
  return { fixture, el, conditions, button: () => el.querySelector('button') };
}

describe('EvolutionConditions (molécula)', () => {
  it('una sola condición se muestra sin botón', () => {
    const { conditions, button } = create(['Piedra Fuego']);
    expect(conditions()).toEqual(['Piedra Fuego']);
    expect(button()).toBeNull();
  });

  it('con varias muestra la primera y despliega el resto bajo «+N más»', () => {
    const { fixture, conditions, button } = create(['A', 'B', 'C']);
    expect(conditions()).toEqual(['A']);
    expect(button()!.textContent).toContain('+2');
    expect(button()!.getAttribute('aria-expanded')).toBe('false');

    button()!.click();
    fixture.detectChanges();
    expect(conditions()).toEqual(['A', 'B', 'C']);
    expect(button()!.getAttribute('aria-expanded')).toBe('true');
    expect(button()!.textContent).toContain('Ocultar');

    button()!.click();
    fixture.detectChanges();
    expect(conditions()).toEqual(['A']);
  });

  it('el texto accesible nombra la etapa de destino', () => {
    const { el } = create(['A']);
    expect(el.querySelector('.visually-hidden')?.textContent).toContain('Leafeon');
  });
});

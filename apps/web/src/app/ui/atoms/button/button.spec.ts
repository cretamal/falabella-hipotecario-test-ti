import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';

/**
 * El componente anfitrión: aplica el botón sobre los tres elementos posibles (`button`, `a` y `span`).
 */
@Component({
  imports: [Button],
  template: `
    <button appButton id="plain" type="button">Uno</button>
    <a appButton="primary" id="primary" href="/x">Dos</a>
    <span appButton id="disabled" aria-disabled="true">Tres</span>
  `,
})
class Host {}

describe('Button (átomo)', () => {
  it('se aplica sobre button, a y span; solo la variante primary lleva la clase', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    /** Busca un elemento del anfitrión por su id. */
    const q = (id: string) =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${id}`)!;
    expect(q('plain').classList).not.toContain('primary');
    expect(q('primary').classList).toContain('primary');
    expect(q('primary').textContent).toBe('Dos');
    expect(q('disabled').getAttribute('aria-disabled')).toBe('true');
  });
});

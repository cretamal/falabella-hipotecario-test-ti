import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Panel } from './panel';

/** El componente anfitrión: un panel con título y contenido proyectado. */
@Component({
  imports: [Panel],
  template: `<app-panel heading="Título" headingId="t"><p class="inside">contenido</p></app-panel>`,
})
class Host {}

describe('Panel (molécula)', () => {
  it('encabeza la sección, la etiqueta y proyecta el contenido', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.id).toBe('t');
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe('t');
    expect(el.querySelector('.inside')?.textContent).toBe('contenido');
  });
});

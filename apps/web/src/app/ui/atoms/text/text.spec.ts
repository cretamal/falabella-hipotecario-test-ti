import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Text, type TextTag } from './text';

/**
 * El componente anfitrión: `app-text` con distintas etiquetas, atributos y contenido proyectado.
 */
@Component({
  imports: [Text],
  template: `
    <app-text [as]="tag" [id]="'t1'" weight="semibold" tone="muted" numeric text="hola" />
    <app-text as="p" role="status" live="polite">uno <b>dos</b></app-text>
    <app-text as="label" [for]="'campo'">etiqueta</app-text>
  `,
})
class Host {
  tag: TextTag = 'h2';
}

describe('Text (átomo)', () => {
  it('crea la etiqueta pedida y la cambia en tiempo de ejecución', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-text > h2')?.id).toBe('t1');
    expect(el.querySelector('app-text > h2')?.textContent).toBe('hola');

    fixture.componentInstance.tag = 'h3';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(el.querySelector('app-text > h2')).toBeNull();
    expect(el.querySelector('app-text > h3')?.textContent).toBe('hola');
  });

  it('expone peso, tono y números como data-attributes (tokens en CSS)', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-text')!;
    expect(host.getAttribute('data-weight')).toBe('semibold');
    expect(host.getAttribute('data-tone')).toBe('muted');
    expect(host.hasAttribute('data-numeric')).toBe(true);
  });

  it('proyecta contenido rico y aplica role/aria-live al elemento interno', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const p = (fixture.nativeElement as HTMLElement).querySelector('app-text > p')!;
    expect(p.getAttribute('role')).toBe('status');
    expect(p.getAttribute('aria-live')).toBe('polite');
    expect(p.querySelector('b')?.textContent).toBe('dos');
    expect(p.parentElement?.hasAttribute('role')).toBe(false);
  });

  it('enlaza la etiqueta con su campo (for)', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('label')?.getAttribute('for')).toBe(
      'campo',
    );
  });
});

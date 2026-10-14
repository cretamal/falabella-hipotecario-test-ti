import { TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton';

/** Pinta el marcador con los inputs indicados y devuelve su elemento. */
function render(inputs: Record<string, unknown>): HTMLElement {
  const fixture = TestBed.createComponent(Skeleton);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Skeleton (átomo)', () => {
  it('es decorativo y expone su forma', () => {
    const el = render({ shape: 'circle', width: '72px' });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-shape')).toBe('circle');
    expect(el.style.width).toBe('72px');
  });

  it('en texto dibuja una barra por línea; el resto de formas, ninguna', () => {
    expect(render({ shape: 'text', lines: 3 }).querySelectorAll('.bar')).toHaveLength(3);
    expect(render({ shape: 'block', lines: 3 }).querySelectorAll('.bar')).toHaveLength(0);
  });
});

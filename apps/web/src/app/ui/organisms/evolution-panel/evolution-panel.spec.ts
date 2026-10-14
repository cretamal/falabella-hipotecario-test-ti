import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EVOLUTION } from '../../../../../test-support/fakes';
import { EvolutionPanel } from './evolution-panel';

/** Crea el panel de evolución con los inputs indicados. */
function create(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EvolutionPanel);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('EvolutionPanel (organismo)', () => {
  it('sin datos ni error: marcadores', () => {
    const { el } = create({});
    expect(el.querySelectorAll('app-skeleton')).toHaveLength(3);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('con la cadena: el árbol compacto, con su título de sección', () => {
    const { el } = create({ root: EVOLUTION, currentName: 'pikachu' });
    expect(el.querySelector('app-evolution-tree.compact')).not.toBeNull();
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe('evolution-heading');
    expect(el.querySelectorAll('#evolution-heading')).toHaveLength(1); // sin id duplicado en el host
    expect(el.querySelector('h2#evolution-heading')?.textContent).toContain('Evolución');
    expect(el.querySelectorAll('app-skeleton')).toHaveLength(0);
  });

  it('sin evoluciones no ocupa espacio: se oculta y no pinta nada', () => {
    const { el } = create({ root: { ...EVOLUTION, evolvesTo: [] } });
    expect(el.classList).toContain('none');
    expect(el.textContent?.trim()).toBe('');
  });

  it('mientras carga es visible', () => {
    expect(create({}).el.classList).not.toContain('none');
  });

  it('en error es visible', () => {
    expect(create({ failed: true }).el.classList).not.toContain('none');
  });

  it('con error: alerta con «Reintentar» que avisa', () => {
    const { fixture, el } = create({ failed: true });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar la evolución',
    );
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(retries).toBe(1);
    expect(el.querySelectorAll('app-skeleton')).toHaveLength(0);
  });
});

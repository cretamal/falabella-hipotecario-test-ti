import { TestBed } from '@angular/core/testing';
import { Meter } from './meter';

/** Crea la barra con un máximo de 200 y la etiqueta «PS»; el test agrega o pisa lo que necesite. */
function create(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(Meter);
  fixture.componentRef.setInput('max', 200);
  fixture.componentRef.setInput('label', 'PS');
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    meter: el.querySelector('[role="meter"]')!,
    fill: el.querySelector<HTMLElement>('.fill')!,
  };
}

describe('Meter (átomo)', () => {
  it('expone sus valores a las tecnologías de apoyo y rellena según el valor', () => {
    const { meter, fill } = create({ value: 50 });
    expect(meter.getAttribute('aria-label')).toBe('PS');
    expect(meter.getAttribute('aria-valuenow')).toBe('50');
    expect(meter.getAttribute('aria-valuemax')).toBe('200');
    expect(fill.style.width).toBe('25%');
  });

  it('el relleno no se sale de la pista y acepta color, texto y guías', () => {
    const { meter, fill } = create({
      value: 999,
      tone: 'top',
      valueText: '999, excepcional',
      guides: true,
    });
    expect(fill.style.width).toBe('100%');
    expect(meter.classList).toContain('top');
    expect(meter.classList).toContain('guides');
    expect(meter.getAttribute('aria-valuetext')).toBe('999, excepcional');
  });
});

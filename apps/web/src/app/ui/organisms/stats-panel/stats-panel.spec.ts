import { TestBed } from '@angular/core/testing';
import { StatsPanel } from './stats-panel';

/** Crea el panel con las estadísticas dadas (o cargando si no hay). */
function create(stats?: { name: string; label: string; value: number }[]) {
  const fixture = TestBed.createComponent(StatsPanel);
  if (stats) fixture.componentRef.setInput('stats', stats);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const STATS = [
  { name: 'hp', label: 'PS', value: 35 },
  { name: 'speed', label: 'Velocidad', value: 90 },
];

describe('StatsPanel (organismo)', () => {
  it('pinta una barra por estadística y suma el total', () => {
    const el = create(STATS);
    expect(el.querySelectorAll('app-stat-bar')).toHaveLength(2);
    expect(el.querySelector('.total')?.textContent?.trim()).toBe('125');
    expect(el.querySelector('[role="meter"]')?.getAttribute('aria-valuemax')).toBe('255');
  });

  it('cada barra tiene el color de su tramo y lo dice en texto', () => {
    const meters = Array.from(create(STATS).querySelectorAll('.bars [role="meter"]'));
    expect(meters.map((m) => m.classList.contains('low') || m.classList.contains('high'))).toEqual([
      true,
      true,
    ]);
    expect(meters.map((m) => m.getAttribute('aria-valuetext'))).toEqual(['35, bajo', '90, alto']);
  });

  it('el resumen muestra el total con su nivel (escala 720)', () => {
    const el = create([
      { name: 'a', label: 'A', value: 100 },
      { name: 'b', label: 'B', value: 100 },
      { name: 'c', label: 'C', value: 100 },
      { name: 'd', label: 'D', value: 100 },
      { name: 'e', label: 'E', value: 100 },
      { name: 'f', label: 'F', value: 100 },
    ]);
    const meter = el.querySelector('.summary [role="meter"]')!;
    expect(meter.getAttribute('aria-valuemax')).toBe('720');
    expect(meter.getAttribute('aria-valuetext')).toBe('600, excepcional');
    expect(meter.classList).toContain('top');
  });

  it('sin datos: marcadores con las mismas zonas', () => {
    const el = create();
    expect(el.querySelectorAll('.bars app-skeleton')).toHaveLength(6);
    expect(el.querySelectorAll('.summary app-skeleton').length).toBeGreaterThan(0);
    expect(el.querySelector('[role="meter"]')).toBeNull();
  });
});

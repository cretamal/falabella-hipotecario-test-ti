import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EvolutionStage, STAGE_INTENT_DELAY_MS } from './evolution-stage';

/** Crea una etapa de Pikachu (#25) con los inputs extra que pida el test. */
function create(inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EvolutionStage);
  fixture.componentRef.setInput('stage', { id: 25, label: 'Pikachu', imageUrl: '25.png' });
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const intents: string[] = [];
  fixture.componentInstance.intent.subscribe((id) => intents.push(id));
  return { el, img: el.querySelector('img')!, intents };
}

describe('EvolutionStage (molécula)', () => {
  it('enlaza al detalle, muestra el nombre y resalta la etapa actual', () => {
    const { el } = create({ current: true });
    const stage = el.querySelector('div.stage')!;
    expect(stage.getAttribute('role')).toBe('link');
    expect(stage.getAttribute('aria-current')).toBe('page');
    expect(stage.textContent).toContain('Pikachu');
  });

  it('por defecto la miniatura es de 72 px', () => {
    const { el, img } = create();
    expect(img.getAttribute('width')).toBe('72');
    expect(el.classList).not.toContain('compact');
  });

  it('en modo compacto la miniatura es de 48 px', () => {
    const { el, img } = create({ compact: true });
    expect(img.getAttribute('width')).toBe('48');
    expect(el.classList).toContain('compact');
  });

  describe('intención de abrirla', () => {
    afterEach(() => vi.useRealTimers());

    it('emite su id tras mantener cursor o foco, no antes', () => {
      vi.useFakeTimers();
      const { el, intents } = create();
      const stage = el.querySelector('div.stage')!;
      stage.dispatchEvent(new Event('pointerenter'));
      vi.advanceTimersByTime(STAGE_INTENT_DELAY_MS - 1);
      expect(intents).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(intents).toEqual(['25']);
      stage.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(STAGE_INTENT_DELAY_MS);
      expect(intents).toEqual(['25', '25']);
    });

    it('salir antes cancela; el toque emite al instante', () => {
      vi.useFakeTimers();
      const { el, intents } = create();
      const stage = el.querySelector('div.stage')!;
      stage.dispatchEvent(new Event('pointerenter'));
      vi.advanceTimersByTime(STAGE_INTENT_DELAY_MS - 10);
      stage.dispatchEvent(new Event('pointerleave'));
      vi.advanceTimersByTime(STAGE_INTENT_DELAY_MS);
      expect(intents).toEqual([]);
      stage.dispatchEvent(new Event('touchstart'));
      expect(intents).toEqual(['25']);
    });
  });
});

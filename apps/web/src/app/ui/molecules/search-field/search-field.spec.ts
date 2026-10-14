import { TestBed } from '@angular/core/testing';
import { SearchField } from './search-field';

/** Crea el campo de búsqueda con un valor inicial. */
function create(value = '') {
  const fixture = TestBed.createComponent(SearchField);
  fixture.componentRef.setInput('inputId', 'q');
  fixture.componentRef.setInput('label', 'Buscar');
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector('input')!;
  return { fixture, el, input, emitted: [] as string[] };
}

describe('SearchField (molécula)', () => {
  it('asocia la etiqueta con el campo y muestra el valor inicial', () => {
    const { el, input } = create('char');
    expect(el.querySelector('label')?.getAttribute('for')).toBe('q');
    expect(input.id).toBe('q');
    expect(input.value).toBe('char');
  });

  it('emite el texto en cada pulsación', () => {
    const ctx = create();
    ctx.fixture.componentInstance.textChange.subscribe((v) => ctx.emitted.push(v));
    ctx.input.value = 'pi';
    ctx.input.dispatchEvent(new Event('input'));
    expect(ctx.emitted).toEqual(['pi']);
  });

  it('sigue el valor externo (p. ej. «limpiar») cuando el campo no tiene el foco', () => {
    const { fixture, input } = create('char');
    fixture.componentRef.setInput('value', '');
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('no pisa lo que el usuario está escribiendo', () => {
    const { fixture, input } = create('char');
    document.body.appendChild(fixture.nativeElement);
    input.focus();
    input.value = 'chari';
    fixture.componentRef.setInput('value', 'char');
    fixture.detectChanges();
    expect(input.value).toBe('chari');
    fixture.nativeElement.remove();
  });

  it('Escape vacía el campo y avisa; Enter emite el texto actual', () => {
    const ctx = create('char');
    const changes: string[] = [];
    const submits: string[] = [];
    ctx.fixture.componentInstance.textChange.subscribe((v) => changes.push(v));
    ctx.fixture.componentInstance.submitted.subscribe((v) => submits.push(v));
    ctx.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(submits).toEqual(['char']);
    ctx.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ctx.input.value).toBe('');
    expect(changes).toEqual(['']);
  });

  it('muestra la pista solo cuando se pide y la asocia al campo', () => {
    const { fixture, el, input } = create();
    fixture.componentRef.setInput('hint', 'Mínimo 2');
    fixture.detectChanges();
    expect(el.querySelector('#q-hint')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    fixture.componentRef.setInput('hintVisible', true);
    fixture.detectChanges();
    expect(el.querySelector('#q-hint')?.textContent).toContain('Mínimo 2');
    expect(input.getAttribute('aria-describedby')).toBe('q-hint');
  });

  it('declara atributos de teclado de búsqueda', () => {
    const { input } = create();
    expect(input.getAttribute('inputmode')).toBe('search');
    expect(input.getAttribute('enterkeyhint')).toBe('search');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });
});

import { TestBed } from '@angular/core/testing';
import { SelectField } from './select-field';

/** Crea la lista desplegable con unas opciones de prueba y un valor inicial. */
function create(value = '') {
  const fixture = TestBed.createComponent(SelectField);
  fixture.componentRef.setInput('inputId', 'type');
  fixture.componentRef.setInput('label', 'Tipo');
  fixture.componentRef.setInput('emptyLabel', 'Todos');
  fixture.componentRef.setInput('options', [
    { value: 'fire', label: 'Fuego' },
    { value: 'water', label: 'Agua' },
  ]);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
  return { fixture, select };
}

describe('SelectField (molécula)', () => {
  it('lista la opción vacía y las opciones, con la etiqueta asociada', () => {
    const { fixture, select } = create();
    expect(Array.from(select.options).map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Todos'],
      ['fire', 'Fuego'],
      ['water', 'Agua'],
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelector('label')?.getAttribute('for')).toBe(
      'type',
    );
    expect(select.value).toBe('');
  });

  it('refleja el valor recibido', () => {
    expect(create('water').select.value).toBe('water');
  });

  it('emite el valor elegido (cadena vacía para quitar el filtro)', () => {
    const { fixture, select } = create('fire');
    const emitted: string[] = [];
    fixture.componentInstance.selected.subscribe((v) => emitted.push(v));
    select.value = 'water';
    select.dispatchEvent(new Event('change'));
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual(['water', '']);
  });
});

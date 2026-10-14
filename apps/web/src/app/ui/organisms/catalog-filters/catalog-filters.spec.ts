import { TestBed } from '@angular/core/testing';
import type { CatalogFilters as FiltersData } from '@pokedex/contracts';
import { type CatalogFilterValues, CatalogFilters } from './catalog-filters';

const OPTIONS: FiltersData = {
  types: [{ name: 'fire', label: 'Fuego' }],
  generations: [
    { id: 1, label: 'Generación I' },
    { id: 2, label: 'Generación II' },
  ],
};

/**
 * Crea la barra de filtros y anota lo que emite; devuelve ayudas para escribir y esperar el debounce.
 */
function create(
  values: Partial<CatalogFilterValues> = {},
  options: FiltersData | null = OPTIONS,
  canClear = false,
) {
  const fixture = TestBed.createComponent(CatalogFilters);
  fixture.componentRef.setInput('values', { q: '', type: '', generation: null, ...values });
  fixture.componentRef.setInput('options', options);
  fixture.componentRef.setInput('canClear', canClear);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const events = {
    search: [] as string[],
    type: [] as string[],
    generation: [] as (number | null)[],
    cleared: 0,
  };
  const c = fixture.componentInstance;
  c.searchChange.subscribe((v) => events.search.push(v));
  c.typeChange.subscribe((v) => events.type.push(v));
  c.generationChange.subscribe((v) => events.generation.push(v));
  c.cleared.subscribe(() => events.cleared++);
  /** Simula que el usuario escribe un texto en el buscador. */
  const type = (text: string) => {
    const input = el.querySelector<HTMLInputElement>('#search')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  /** Espera un poquito más que el debounce, para que la búsqueda alcance a salir. */
  const wait = () => new Promise((resolve) => setTimeout(resolve, 380));
  return { fixture, el, events, type, wait };
}

describe('CatalogFilters (organismo)', () => {
  it('emite la búsqueda una sola vez, recortada y con debounce', async () => {
    const { events, type, wait } = create();
    type('p');
    type('pi');
    type('  pika ');
    expect(events.search).toEqual([]);
    await wait();
    expect(events.search).toEqual(['pika']);
  });

  it('no emite si el texto ya es el valor vigente, pero sí si vuelve a escribirlo tras limpiar', async () => {
    const { fixture, events, type, wait } = create({ q: 'char' });
    type('char');
    await wait();
    expect(events.search).toEqual([]);

    fixture.componentRef.setInput('values', { q: '', type: '', generation: null });
    fixture.detectChanges();
    type('char');
    await wait();
    expect(events.search).toEqual(['char']);
  });

  it('emite tipo y generación (número, o null al quitar el filtro)', () => {
    const { el, events } = create({ type: 'fire', generation: 2 });
    expect(el.querySelector<HTMLSelectElement>('#type')!.value).toBe('fire');
    expect(el.querySelector<HTMLSelectElement>('#generation')!.value).toBe('2');

    const type = el.querySelector<HTMLSelectElement>('#type')!;
    type.value = '';
    type.dispatchEvent(new Event('change'));
    const generation = el.querySelector<HTMLSelectElement>('#generation')!;
    generation.value = '1';
    generation.dispatchEvent(new Event('change'));
    generation.value = '';
    generation.dispatchEvent(new Event('change'));
    expect(events.type).toEqual(['']);
    expect(events.generation).toEqual([1, null]);
  });

  it('oculta los selectores sin opciones y muestra «Limpiar» solo si hay filtros', () => {
    const none = create({}, null, false);
    expect(none.el.querySelector('#type')).toBeNull();
    expect(none.el.querySelector('#search')).not.toBeNull();
    expect(none.el.querySelector('button')).toBeNull();

    const active = create({ q: 'x' }, OPTIONS, true);
    active.el.querySelector('button')!.click();
    expect(active.events.cleared).toBe(1);
  });

  it('con un solo carácter avisa del mínimo y no busca; con 2 sí', async () => {
    const { el, events, type, wait, fixture } = create();
    type('p');
    fixture.detectChanges();
    expect(el.querySelector('#search')!.getAttribute('aria-describedby')).toBe('search-hint');
    expect(el.querySelector('#search-hint')?.textContent).toContain('2 caracteres');
    await wait();
    expect(events.search).toEqual([]);

    type('pi');
    fixture.detectChanges();
    expect(el.querySelector('#search-hint')).toBeNull();
    await wait();
    expect(events.search).toEqual(['pi']);
  });

  it('borrar hasta 1 carácter cancela la búsqueda pendiente', async () => {
    const { events, type, wait } = create();
    type('pika');
    type('p');
    await wait();
    expect(events.search).toEqual([]);
  });

  it('un dígito suelto sí busca (número de Pokémon)', async () => {
    const { events, type, wait } = create();
    type('7');
    await wait();
    expect(events.search).toEqual(['7']);
  });

  it('vaciar el campo limpia al instante, sin esperar al debounce', () => {
    const { events, type } = create({ q: 'char' });
    type('');
    expect(events.search).toEqual(['']);
  });

  it('Enter busca de inmediato y Escape vacía el campo', () => {
    const { el, events, type } = create();
    type('pika');
    const input = el.querySelector<HTMLInputElement>('#search')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(events.search).toEqual(['pika']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('');
  });

  it('normaliza espacios y caracteres de control antes de emitir', async () => {
    const { events, type, wait } = create();
    type('  pika   chu\t');
    await wait();
    expect(events.search).toEqual(['pika chu']);
  });
});

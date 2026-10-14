import { convertToParamMap } from '@angular/router';
import {
  PAGE_SIZE,
  hasActiveFilters,
  parseCatalogParams,
  sameCatalogParams,
  toApiQuery,
  toQueryParams,
} from './catalog-params';

/** Interpreta un objeto como si fuera el query string de la URL. */
const parse = (params: Record<string, string>) => parseCatalogParams(convertToParamMap(params));

describe('catalog params', () => {
  it('usa valores por defecto con una URL vacía', () => {
    expect(parse({})).toEqual({ q: '', type: '', generation: null, page: 1 });
  });

  it('lee q, type, gen y page', () => {
    expect(parse({ q: ' pika ', type: 'electric', gen: '1', page: '3' })).toEqual({
      q: 'pika',
      type: 'electric',
      generation: 1,
      page: 3,
    });
  });

  it('ignora números inválidos en la URL', () => {
    expect(parse({ gen: 'abc', page: '-2' })).toMatchObject({ generation: null, page: 1 });
    expect(parse({ page: '1.5' }).page).toBe(1);
  });

  it('la query string omite los valores por defecto (y es reversible)', () => {
    expect(toQueryParams({ q: '', type: '', generation: null, page: 1 })).toEqual({
      q: null,
      type: null,
      gen: null,
      page: null,
    });
    const params = { q: 'char', type: 'fire', generation: 1, page: 2 };
    expect(toQueryParams(params)).toEqual({ q: 'char', type: 'fire', gen: 1, page: 2 });
  });

  it('calcula offset y límite para la API', () => {
    expect(toApiQuery({ q: '', type: '', generation: null, page: 3 })).toEqual({
      q: undefined,
      type: undefined,
      generation: undefined,
      offset: 2 * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
  });

  it('compara y detecta filtros activos', () => {
    const base = { q: '', type: '', generation: null, page: 1 };
    expect(sameCatalogParams(base, { ...base })).toBe(true);
    expect(sameCatalogParams(base, { ...base, page: 2 })).toBe(false);
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, generation: 2 })).toBe(true);
    expect(hasActiveFilters({ ...base, page: 5 })).toBe(false);
  });
});

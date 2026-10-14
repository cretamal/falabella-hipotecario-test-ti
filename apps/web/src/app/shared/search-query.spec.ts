import fixtures from '../../../../../packages/contracts/search-fixtures.json';
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  isSearchable,
  isTooShort,
  normalizeQuery,
  searchKey,
} from './search-query';

describe('paridad de búsqueda con el BFF', () => {
  it('normaliza igual que el BFF', () => {
    for (const [input, expected] of fixtures.normalize as [string, string][])
      expect(searchKey(input), JSON.stringify(input)).toBe(expected);
  });
  it('comparte los límites', () => {
    expect(SEARCH_MAX_LENGTH).toBe(fixtures.maxLength);
    expect(SEARCH_MIN_LENGTH).toBe(fixtures.minLength);
  });
});

describe('normalizeQuery', () => {
  it('colapsa espacios, quita controles y recorta', () => {
    expect(normalizeQuery('  pika \t\n  chu ')).toBe('pika chu');
    expect(normalizeQuery('a\u0000b')).toBe('a b');
  });
  it('corta a la longitud máxima sin dejar espacios finales', () => {
    expect(normalizeQuery('a'.repeat(80))).toHaveLength(SEARCH_MAX_LENGTH);
    expect(normalizeQuery(`${'a'.repeat(49)} b`)).toBe('a'.repeat(49));
  });
});

describe('isSearchable / isTooShort', () => {
  it('exige 2 caracteres, salvo un dígito', () => {
    expect(isSearchable('pi')).toBe(true);
    expect(isSearchable('p')).toBe(false);
    expect(isSearchable('7')).toBe(true);
    expect(isSearchable('')).toBe(false);
  });
  it('avisa solo si hay un único carácter útil', () => {
    expect(isTooShort('p')).toBe(true);
    expect(isTooShort('!')).toBe(false);
    expect(isTooShort('')).toBe(false);
    expect(isTooShort('7')).toBe(false);
  });
});

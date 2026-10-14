import { readFileSync } from 'node:fs';
import { resolveLang } from './lang.js';
import {
  SEARCH_MAX_LENGTH,
  cleanText,
  formatName,
  normalizeSearch,
} from './text.js';

describe('text', () => {
  it('normalizeSearch ignora mayúsculas, acentos y separadores', () => {
    expect(normalizeSearch('  Mr. Mime ')).toBe('mr mime');
    expect(normalizeSearch('mr-mime')).toBe('mr mime');
    expect(normalizeSearch('Flabébé')).toBe('flabebe');
  });
  it('formatName y cleanText', () => {
    expect(formatName('mr-mime')).toBe('Mr Mime');
    expect(cleanText('Línea uno\nlínea\fdos  ')).toBe('Línea uno línea dos');
  });
});

describe('resolveLang', () => {
  it('?lang gana sobre Accept-Language', () => {
    expect(resolveLang('en', 'es-CL,es;q=0.9')).toBe('en');
  });
  it('usa el idioma soportado de mayor prioridad', () => {
    expect(resolveLang(undefined, 'fr-FR,en-US;q=0.8,es;q=0.5')).toBe('en');
    expect(resolveLang(undefined, 'en;q=0.4,es;q=0.9')).toBe('es');
  });
  it('por defecto español', () => {
    expect(resolveLang(undefined, undefined)).toBe('es');
    expect(resolveLang('xx', 'de,fr')).toBe('es');
  });
});

describe('paridad de búsqueda con el web', () => {
  const fixtures = JSON.parse(
    readFileSync(
      new URL(
        '../../../../packages/contracts/search-fixtures.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { maxLength: number; normalize: [string, string][] };

  it('normaliza igual que el web', () => {
    for (const [input, expected] of fixtures.normalize)
      expect(normalizeSearch(input), JSON.stringify(input)).toBe(expected);
  });
  it('comparte la longitud máxima', () => {
    expect(SEARCH_MAX_LENGTH).toBe(fixtures.maxLength);
  });
});

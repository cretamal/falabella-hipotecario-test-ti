import {
  type SearchEntry,
  buildSearchEntries,
  parseQuery,
  search,
  withinOneEdit,
} from './search.js';

const entries: SearchEntry[] = buildSearchEntries(
  [
    ['bulbasaur', 1],
    ['charmander', 4],
    ['charizard', 6],
    ['pikachu', 25],
    ['mr-mime', 122],
    ['cyndaquil', 155],
    ['tapu-koko', 785],
    ['pikachu-gmax', 10199],
    ['scarecrow', 900],
    ['porygon2', 233],
  ].map(([name, id]) => ({
    id: id as number,
    name: name as string,
    types: ['fire'],
    generation: 1,
    species: name as string,
  })),
);

/**
 * Los nombres que encuentra una búsqueda sobre las entradas de prueba, ya en orden de relevancia.
 */
const names = (q: string, filter = {}) =>
  search(entries, parseQuery(q), filter).matches.map((e) => e.name);

describe('parseQuery', () => {
  it('vacío o solo espacios → sin filtro', () => {
    expect(parseQuery(undefined)).toEqual({ kind: 'all' });
    expect(parseQuery('   ')).toEqual({ kind: 'all' });
  });
  it('texto que se reduce a nada → sin resultados, no todo el catálogo', () => {
    expect(parseQuery('!!!')).toEqual({ kind: 'none' });
    expect(parseQuery('😀')).toEqual({ kind: 'none' });
    expect(search(entries, parseQuery('!!!'), {}).matches).toEqual([]);
  });
  it('reconoce números con o sin #', () => {
    expect(parseQuery('#025')).toMatchObject({ id: 25 });
    expect(parseQuery('25')).toMatchObject({ id: 25 });
    expect(parseQuery('pika')).toMatchObject({ id: null });
    expect(parseQuery('12345')).toMatchObject({ id: null });
  });
});

describe('search · relevancia', () => {
  it('ordena exacto > prefijo > palabra > subcadena, y por id a igual relevancia', () => {
    expect(names('char')).toEqual(['charmander', 'charizard']);
    expect(names('mime')).toEqual(['mr-mime']);
    expect(names('ika')).toEqual(['pikachu', 'pikachu-gmax']);
    // "cr" no es prefijo de "scarecrow", pero "crow" sí es subcadena: sirve de ejemplo de subcadena
    expect(names('crow')).toEqual(['scarecrow']);
    expect(names('pikachu')).toEqual(['pikachu', 'pikachu-gmax']);
  });

  it('el exacto gana al prefijo aunque tenga id mayor', () => {
    const list = buildSearchEntries([
      { id: 1, name: 'pikachu-x', types: [], generation: 1, species: null },
      { id: 2, name: 'pikachu', types: [], generation: 1, species: null },
    ]);
    expect(
      search(list, parseQuery('pikachu'), {}).matches.map((e) => e.name),
    ).toEqual(['pikachu', 'pikachu-x']);
  });

  it('un prefijo de palabra posterior puntúa mejor que una subcadena', () => {
    const list = buildSearchEntries([
      { id: 1, name: 'xmime', types: [], generation: 1, species: null },
      { id: 2, name: 'mr-mime', types: [], generation: 1, species: null },
    ]);
    expect(
      search(list, parseQuery('mime'), {}).matches.map((e) => e.name),
    ).toEqual(['mr-mime', 'xmime']);
  });

  it('varias palabras en cualquier orden', () => {
    expect(names('mime mr')).toEqual(['mr-mime']);
    expect(names('tapu ko')).toEqual(['tapu-koko']);
    expect(names('Mr. Mime')).toEqual(['mr-mime']);
  });

  it('el número va primero, seguido de coincidencias de texto', () => {
    expect(names('25')).toEqual(['pikachu']);
    expect(names('#025')).toEqual(['pikachu']);
    expect(names('233')).toEqual(['porygon2']);
    expect(names('2')).toEqual(['porygon2']); // sin id 2: solo calza por texto
    expect(names('99999')).toEqual([]);
  });

  it('combina con tipo y generación', () => {
    expect(names('char', { type: 'water' })).toEqual([]);
    expect(names('char', { type: 'fire', generation: 1 })).toHaveLength(2);
  });

  it('sin texto conserva el orden de entrada (por id)', () => {
    expect(names('')).toHaveLength(entries.length);
  });
});

describe('search · erratas', () => {
  it('solo si no hay coincidencias exactas', () => {
    const r = search(entries, parseQuery('pikchu'), {});
    expect(r.fuzzy).toBe(true);
    expect(r.matches.map((e) => e.name)).toEqual(['pikachu', 'pikachu-gmax']);
    expect(search(entries, parseQuery('pika'), {}).fuzzy).toBe(false);
  });

  it('transposición, sustitución, inserción y borrado', () => {
    expect(names('pikahcu')).toContain('pikachu');
    expect(names('pikaxhu')).toContain('pikachu');
    expect(names('pikacchu')).toContain('pikachu');
    expect(names('pikahu')).toContain('pikachu');
    expect(names('charmandr')).toContain('charmander');
  });

  it('no se aplica con menos de 4 caracteres ni con dos errores', () => {
    expect(names('pkc')).toEqual([]);
    expect(names('pkchu')).toEqual([]);
  });

  it('sin parecidos → vacío y sin marca', () => {
    expect(search(entries, parseQuery('zzzzzz'), {})).toEqual({
      matches: [],
      fuzzy: false,
    });
  });
});

describe('withinOneEdit', () => {
  it.each([
    ['abc', 'abc', true],
    ['abc', 'abd', true],
    ['abc', 'ab', true],
    ['ab', 'abc', true],
    ['abc', 'acb', true],
    ['abc', 'xyz', false],
    ['abc', 'a', false],
    ['abcd', 'badc', false],
  ])('%s ~ %s → %s', (a, b, expected) => {
    expect(withinOneEdit(a, b)).toBe(expected);
  });
});

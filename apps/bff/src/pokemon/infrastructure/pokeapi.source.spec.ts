import { BadGatewayException } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Memoizer } from '../../common/memoizer.js';
import { configuration } from '../../config/configuration.js';
import { PokeApiClient } from './pokeapi.client.js';
import { PokeApiSource } from './pokeapi.source.js';

import { BASE, FIXTURES, json } from '../../../test/pokeapi-fixtures.js';

/**
 * Arma el adaptador con un `fetch` falso que responde desde las fixtures (o desde `handler`, cuando el test quiere forzar
 * algo distinto).
 */
async function setup(handler?: (path: string) => Response | undefined) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = input;
    const path = url.slice(BASE.length).replace(/\/$/, '');
    const custom = handler?.(path);
    if (custom) return custom;
    return path in FIXTURES && FIXTURES[path] !== undefined
      ? json(FIXTURES[path])
      : new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
      CacheModule.register(),
    ],
    providers: [Memoizer, PokeApiClient, PokeApiSource],
  }).compile();
  return {
    source: moduleRef.get(PokeApiSource),
    memo: moduleRef.get(Memoizer),
    fetchMock,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('PokeApiSource.fetchIndex', () => {
  it('une tipos (por slot) y generación, incluidas las formas por prefijo', async () => {
    const { source } = await setup();
    const index = await source.fetchIndex();
    const byName = Object.fromEntries(index.entries.map((e) => [e.name, e]));
    expect(byName['bulbasaur']).toEqual({
      id: 1,
      name: 'bulbasaur',
      types: ['grass', 'poison'],
      generation: 1,
      species: 'bulbasaur',
    });
    expect(byName['mr-mime-galar']).toMatchObject({
      id: 10168,
      types: ['psychic'],
      generation: 1,
      species: 'mr-mime',
    });
    expect(index.entries.map((e) => e.id)).toEqual([1, 25, 122, 10168]);
    expect(byName['pikachu'].types).toEqual([]);
  });

  it('descarta tipos sin Pokémon, ordena generaciones y conserva etiquetas por idioma', async () => {
    const { source } = await setup();
    const index = await source.fetchIndex();
    expect(index.types.map((t) => t.name)).toEqual([
      'grass',
      'poison',
      'psychic',
    ]);
    expect(index.types[0].labels).toEqual({ es: 'Planta', en: 'Grass' });
    expect(index.types[2].labels).toEqual({ en: 'Psychic' });
    expect(index.generations.map((g) => g.id)).toEqual([1, 2]);
  });
});

describe('PokeApiSource.fetchDetail', () => {
  it('mapea unidades, textos localizados y etiquetas', async () => {
    const { source } = await setup();
    const d = (await source.fetchDetail('pikachu', 'es'))!;
    expect(d).toMatchObject({
      id: 25,
      name: 'pikachu',
      label: 'Pikachú',
      genus: 'Pokémon Ratón',
      heightM: 0.4,
      weightKg: 6,
      generation: { id: 1, label: 'Generación I' },
      legendary: false,
      mythical: false,
      types: [{ name: 'electric', label: 'Eléctrico' }],
    });
    expect(d.description).toBe('Texto más reciente en español');
    expect(d.imageUrl).toBe('front.png');
    expect(d.stats).toEqual([
      { name: 'hp', label: 'PS', value: 35 },
      { name: 'speed', label: 'Velocidad', value: 90 },
    ]);
    expect(d.abilities).toEqual([
      { name: 'static', label: 'Electricidad Estática', hidden: false },
      { name: 'lightning-rod', label: 'Lightning Rod', hidden: true },
    ]);
  });

  it('usa inglés cuando falta el idioma pedido', async () => {
    const { source } = await setup();
    const d = (await source.fetchDetail('pikachu', 'en'))!;
    expect(d.genus).toBe('Mouse Pokémon');
    expect(d.description).toBe('English text');
  });

  it('arma el árbol evolutivo con ramas y condiciones localizadas', async () => {
    const { source } = await setup();
    const evolution = (await source.fetchEvolution('pikachu', 'es'))!;
    expect(evolution).toMatchObject({ id: 172, name: 'pichu', conditions: [] });
    const pikachu = evolution.evolvesTo[0];
    expect(pikachu.conditions).toEqual(['Amistad 220']);
    expect(pikachu.evolvesTo.map((n) => [n.id, n.conditions])).toEqual([
      [26, ['Piedra Trueno']],
      [10100, ['Nivel 30']],
    ]);
    expect(pikachu.imageUrl).toMatch(/\/25\.png$/);
  });

  it('devuelve null si el Pokémon no existe', async () => {
    const { source } = await setup();
    expect(await source.fetchDetail('no-existe', 'es')).toBeNull();
  });

  it('una etiqueta secundaria caída no tumba el detalle', async () => {
    const { source } = await setup((path) =>
      path === '/stat/hp' ? new Response('', { status: 400 }) : undefined,
    );
    const d = (await source.fetchDetail('pikachu', 'es'))!;
    expect(d.stats[0]).toEqual({ name: 'hp', label: 'Hp', value: 35 });
  });
});

describe('PokeApiClient: errores', () => {
  it('reintenta una vez ante un 5xx y se recupera', async () => {
    let calls = 0;
    const { source } = await setup((path) =>
      path === '/pokemon/pikachu' && calls++ === 0
        ? new Response('', { status: 503 })
        : undefined,
    );
    expect((await source.fetchDetail('pikachu', 'es'))?.id).toBe(25);
    expect(calls).toBe(2);
  });

  it('5xx persistente → 502', async () => {
    const { source, fetchMock } = await setup(
      () => new Response('', { status: 500 }),
    );
    await expect(source.fetchDetail('pikachu', 'es')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('error de red / timeout → 502', async () => {
    const { source } = await setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    await expect(source.fetchIndex()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('no sigue URLs de otro origen', async () => {
    const { source } = await setup((path) =>
      path === '/pokemon/pikachu'
        ? json({
            ...(FIXTURES['/pokemon/pikachu'] as object),
            species: { name: 'x', url: 'https://evil.example/s' },
          })
        : undefined,
    );
    await expect(source.fetchDetail('pikachu', 'es')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('PokeApiSource: etiquetas y peticiones compartidas', () => {
  it('fetchIndex siembra las etiquetas de tipos y generaciones (solo las etiquetas, no el JSON)', async () => {
    const { source, memo } = await setup();
    await source.fetchIndex();
    expect(await memo.peek('label:type:grass')).toEqual({
      es: 'Planta',
      en: 'Grass',
    });
    expect(await memo.peek('label:generation:generation-i')).toEqual({
      es: 'Generación I',
      en: 'Generation I',
    });
  });

  it('cachea solo las etiquetas de un recurso (no su JSON completo)', async () => {
    const { source, memo } = await setup();
    await source.fetchDetail('pikachu', 'es');
    expect(await memo.peek('label:ability:static')).toEqual({
      es: 'Electricidad Estática',
      en: 'Static',
    });
    expect(
      await memo.peek('pokeapi:https://pokeapi.co/api/v2/ability/static'),
    ).toBeUndefined();
  });

  it('detalle y evolución simultáneos comparten la petición de la especie', async () => {
    const { source, fetchMock } = await setup();
    await Promise.all([
      source.fetchDetail('pikachu', 'es', 'pikachu'),
      source.fetchEvolution('pikachu', 'es', 'pikachu'),
    ]);
    const species = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/pokemon-species/pikachu'),
    );
    expect(species).toHaveLength(1);
  });

  it('una pista de especie que no es la del Pokémon se descarta (índice desfasado)', async () => {
    const { source } = await setup((path) =>
      path === '/pokemon-species/otra'
        ? json({ ...(FIXTURES['/pokemon-species/25'] as object), id: 999 })
        : undefined,
    );
    const detail = await source.fetchDetail('pikachu', 'es', 'otra');
    expect(detail?.label).toBe('Pikachú'); // usó la especie real (25), no la de la pista (el índice podía estar desfasado)
  });

  it('una pista de especie inexistente cae al camino secuencial', async () => {
    const { source } = await setup();
    expect((await source.fetchDetail('pikachu', 'es', 'no-existe'))?.id).toBe(
      25,
    );
  });

  it('warm calienta las 6 etiquetas de estadísticas y tolera fallos', async () => {
    const { source, fetchMock } = await setup((path) =>
      path === '/stat/hp' ? new Response('', { status: 500 }) : undefined,
    );
    await expect(source.warm()).resolves.toBeUndefined();
    const stats = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/stat/'),
    );
    expect(stats.length).toBeGreaterThanOrEqual(6);
  });

  it('fetchEvolution devuelve null si el Pokémon no existe (sin pista)', async () => {
    const { source } = await setup();
    expect(await source.fetchEvolution('no-existe', 'es')).toBeNull();
  });
});

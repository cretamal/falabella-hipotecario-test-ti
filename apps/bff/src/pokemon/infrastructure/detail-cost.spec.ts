import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Memoizer } from '../../common/memoizer.js';
import { configuration } from '../../config/configuration.js';
import { BASE, FIXTURES, json } from '../../../test/pokeapi-fixtures.js';
import { PokeApiClient } from './pokeapi.client.js';
import { PokeApiSource } from './pokeapi.source.js';

const LATENCY_MS = 50;

/**
 * Puerta de regresión determinista (RNF-D1…D3): cada llamada a PokéAPI demora `LATENCY_MS` de tiempo virtual, así
 * `elapsed / LATENCY_MS` es la cantidad de etapas en secuencia (y no depende del reloj, no hay flakiness).
 */
async function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const path = input.slice(BASE.length).replace(/\/$/, '');
      calls.push(path);
      await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
      return path in FIXTURES
        ? json(FIXTURES[path])
        : new Response('{}', { status: 404 });
    }),
  );
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
      CacheModule.register(),
    ],
    providers: [Memoizer, PokeApiClient, PokeApiSource],
  }).compile();
  const source = moduleRef.get(PokeApiSource);

  /**
   * Ejecuta algo y mide cuánto tiempo virtual demoró y cuántas llamadas a PokéAPI hizo mientras tanto.
   */
  async function timed<T>(run: () => Promise<T>) {
    const before = calls.length;
    const start = Date.now();
    let end = start;
    const pending = run().then((value) => {
      end = Date.now();
      return value;
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const value = await pending;
    return {
      value,
      calls: calls.slice(before),
      stages: (end - start) / LATENCY_MS,
    };
  }
  return { source, timed };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('coste del detalle (núcleo)', () => {
  it('con etiquetas en caché: 2 llamadas en 1 etapa (pokemon ∥ species)', async () => {
    const { source, timed } = await setup();
    await timed(() => source.fetchDetail('pikachu', 'es', 'pikachu')); // acá se calientan las etiquetas
    const run = await timed(() =>
      source.fetchDetail('pikachu', 'es', 'pikachu'),
    );
    expect(run.calls.sort()).toEqual([
      '/pokemon-species/pikachu',
      '/pokemon/pikachu',
    ]);
    expect(run.stages).toBe(1);
  });

  it('tras el calentamiento y la siembra del índice: ≤ 5 llamadas en ≤ 2 etapas', async () => {
    const { source, timed } = await setup();
    await timed(() => source.fetchIndex());
    await timed(() => source.warm());
    const run = await timed(() =>
      source.fetchDetail('pikachu', 'es', 'pikachu'),
    );
    // pokemon ∥ species; después, solo las etiquetas de habilidades (tipo, generación y estadísticas ya están
    // sembradas o calentadas).
    expect(run.calls.sort()).toEqual([
      '/ability/lightning-rod',
      '/ability/static',
      '/pokemon-species/pikachu',
      '/pokemon/pikachu',
      '/type/electric',
    ]);
    expect(run.stages).toBe(2);
  });

  it('sin pista de especie usa el camino secuencial (respaldo)', async () => {
    const { source, timed } = await setup();
    await timed(() => source.fetchDetail('pikachu', 'es'));
    const run = await timed(() => source.fetchDetail('pikachu', 'es'));
    expect(run.calls).toEqual(['/pokemon/pikachu', '/pokemon-species/25']);
    expect(run.stages).toBe(2);
  });
});

describe('coste de la evolución', () => {
  it('con etiquetas en caché: species → chain (2 etapas), sin pedir el Pokémon', async () => {
    const { source, timed } = await setup();
    await timed(() => source.fetchEvolution('pikachu', 'es', 'pikachu'));
    const run = await timed(() =>
      source.fetchEvolution('pikachu', 'es', 'pikachu'),
    );
    expect(run.calls).toEqual([
      '/pokemon-species/pikachu',
      '/evolution-chain/10',
    ]);
    expect(run.stages).toBe(2);
  });

  it('en frío: species → chain → etiquetas de objetos y disparadores (≤ 3 etapas)', async () => {
    const { source, timed } = await setup();
    const run = await timed(() =>
      source.fetchEvolution('pikachu', 'es', 'pikachu'),
    );
    expect(run.stages).toBeLessThanOrEqual(3);
  });
});

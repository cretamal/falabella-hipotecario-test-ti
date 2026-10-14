import { createCache } from 'cache-manager';
import type { Lang } from '@pokedex/contracts';
import { ConfigService } from '@nestjs/config';
import { memoryStore } from '../src/config/cache-store.js';
import { configuration } from '../src/config/configuration.js';
import { Memoizer } from '../src/common/memoizer.js';
import { PokemonService } from '../src/pokemon/application/pokemon.service.js';
import {
  type PokemonIndex,
  PokemonSource,
} from '../src/pokemon/application/pokemon-source.port.js';
import { FakePokemonSource } from './fakes.js';

/**
 * Nombres base con los que se arma el índice sintético (incluye los casos difíciles: guiones, tildes y formas).
 */
const BASE = [
  'pikachu',
  'mr-mime',
  'charmander',
  'nidoran-f',
  'tapu-koko',
  'bulbasaur',
  'ivysaur',
  'charizard',
  'eevee',
  'vaporeon',
  'mewtwo',
  'flabebe',
];

/** Un índice sintético del tamaño real de PokéAPI (~1.350 entradas). */
export function syntheticIndex(size = 1350): PokemonIndex {
  return {
    entries: Array.from({ length: size }, (_, i) => ({
      id: i + 1,
      name: `${BASE[i % BASE.length]}${i < BASE.length ? '' : `-${i}`}`,
      types: i % 2 ? ['fire'] : ['water', 'flying'],
      generation: 1 + (i % 9),
      species: BASE[i % BASE.length],
    })),
    types: [
      { name: 'fire', labels: { es: 'Fuego', en: 'Fire' } },
      { name: 'water', labels: { es: 'Agua', en: 'Water' } },
      { name: 'flying', labels: { es: 'Volador', en: 'Flying' } },
    ],
    generations: [
      { id: 1, labels: { es: 'Generación I', en: 'Generation I' } },
    ],
  };
}

/** Un servicio con la misma caché de producción (memoria) y el índice sintético ya cacheado. */
export async function benchService(): Promise<PokemonService> {
  const source = new FakePokemonSource();
  source.fetchIndex = () => Promise.resolve(syntheticIndex());
  const config = new ConfigService({ ...configuration() });
  const service = new PokemonService(
    source as PokemonSource,
    new Memoizer(createCache({ stores: [memoryStore() as never] })),
    config as never,
  );
  await service.list({ offset: 0, limit: 24 }, 'es' satisfies Lang);
  return service;
}

/**
 * Las consultas típicas que se miden: vacía, prefijo, palabra, sin resultados, con errata y por número.
 */
export const QUERIES = ['', 'pi', 'pika', 'mime', 'zzzz', 'pikchu', '25'];

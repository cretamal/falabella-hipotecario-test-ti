import { bench, describe } from 'vitest';
import { QUERIES, benchService } from './search-bench.js';

/** El servicio que comparten todos los casos del benchmark; se arma una sola vez. */
const service = await benchService();

describe('PokemonService.list (1.350 entradas, caché de producción)', () => {
  for (const q of QUERIES) {
    bench(`q="${q}"`, async () => {
      await service.list({ q, offset: 0, limit: 24 }, 'es');
    });
  }
});

describe('PokemonService.detail (caché caliente, RNF-D4)', () => {
  bench('detail("pikachu")', async () => {
    await service.detail('pikachu', 'es');
  });
  bench('evolution("pikachu")', async () => {
    await service.evolution('pikachu', 'es');
  });
});

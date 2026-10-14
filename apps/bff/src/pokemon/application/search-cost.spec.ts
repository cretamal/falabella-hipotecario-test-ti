import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Memoizer } from '../../common/memoizer.js';
import { configuration } from '../../config/configuration.js';
import { FakePokemonSource } from '../../../test/fakes.js';
import { PokemonSource } from './pokemon-source.port.js';
import { PokemonService } from './pokemon.service.js';

const normalizeCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../common/text.js', async (original) => {
  const text = await original<typeof import('../../common/text.js')>();
  return {
    ...text,
    normalizeSearch: (value: string) => {
      normalizeCalls.count++;
      return text.normalizeSearch(value);
    },
  };
});

// Puerta de regresión determinista (no depende del reloj): el costo de la búsqueda no puede volver a crecer con el
// tamaño del índice. Si alguien lo rompe, este test se pone rojo al tiro.
describe('coste de la búsqueda (RNF-B3/B4)', () => {
  it('construye las claves una vez por índice y normaliza solo la consulta', async () => {
    const source = new FakePokemonSource();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        CacheModule.register(),
      ],
      providers: [
        Memoizer,
        PokemonService,
        { provide: PokemonSource, useValue: source },
      ],
    }).compile();
    const service = moduleRef.get(PokemonService);
    const page = { offset: 0, limit: 24 };

    await service.list({ ...page, q: 'pika' }, 'es'); // arma el índice de búsqueda
    const afterBuild = normalizeCalls.count;
    expect(afterBuild).toBeGreaterThanOrEqual(7); // una por cada nombre más la de la consulta

    for (let i = 0; i < 5; i++)
      await service.list({ ...page, q: 'char' }, 'es');
    expect(normalizeCalls.count - afterBuild).toBe(5); // 1 por petición, 0 por nombre (ese es el punto)
  });
});

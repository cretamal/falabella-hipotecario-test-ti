import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Memoizer } from '../../common/memoizer.js';
import { configuration } from '../../config/configuration.js';
import { FakePokemonSource } from '../../../test/fakes.js';
import { PokemonSource } from './pokemon-source.port.js';
import { PokemonService } from './pokemon.service.js';

/**
 * Arma el servicio de verdad con una fuente falsa y caché en memoria; devuelve ambos para poder espiar las llamadas.
 */
async function setup() {
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
  return { source, service: moduleRef.get(PokemonService) };
}

const page = { offset: 0, limit: 24 };

describe('PokemonService.list', () => {
  it('busca por texto parcial, sin distinguir mayúsculas ni separadores', async () => {
    const { service } = await setup();
    /**
     * Los nombres que devuelve el catálogo para una búsqueda (ojo: el orden importa, es el de relevancia).
     */
    const names = async (q: string) =>
      (await service.list({ ...page, q }, 'es')).data.items.map((i) => i.name);
    expect(await names('CHAR')).toEqual(['charmander', 'charizard']);
    expect(await names('!!!')).toEqual([]);
    expect(await names('25')).toEqual(['pikachu']);
    expect(await names('mr mime')).toEqual(['mr-mime']);
    expect(await names('pika')).toEqual(['pikachu', 'pikachu-gmax']);
    expect(await names('zzz')).toEqual([]);
  });

  it('marca los resultados aproximados solo cuando no hay coincidencias', async () => {
    const { service } = await setup();
    const typo = (await service.list({ ...page, q: 'pikchu' }, 'es')).data;
    expect(typo.fuzzy).toBe(true);
    expect(typo.items[0].name).toBe('pikachu');
    const exact = (await service.list({ ...page, q: 'pika' }, 'es')).data;
    expect(exact.fuzzy).toBeUndefined();
  });

  it('combina texto, tipo y generación', async () => {
    const { service } = await setup();
    /**
     * Los nombres que devuelve el catálogo para una combinación de filtros (ahí también importa el orden).
     */
    const run = async (query: object) =>
      (await service.list({ ...page, ...query }, 'es')).data.items.map(
        (i) => i.name,
      );
    expect(await run({ type: 'fire', generation: 1 })).toEqual([
      'charmander',
      'charizard',
    ]);
    expect(await run({ type: 'fire', generation: 2 })).toEqual(['cyndaquil']);
    expect(await run({ type: 'fire', q: 'char' })).toEqual([
      'charmander',
      'charizard',
    ]);
    expect(await run({ type: 'fire', generation: 1, q: 'cynda' })).toEqual([]);
  });

  it('pagina, informa el total y acota el límite', async () => {
    const { service } = await setup();
    const { data } = await service.list({ offset: 2, limit: 2 }, 'es');
    expect(data).toMatchObject({ total: 7, offset: 2, limit: 2 });
    expect(data.items.map((i) => i.id)).toEqual([6, 25]);
    expect(
      (await service.list({ offset: 0, limit: 9999 }, 'es')).data.limit,
    ).toBe(60);
  });

  it('localiza tipos con fallback a inglés y arma la URL de imagen', async () => {
    const { service } = await setup();
    const es = (await service.list({ ...page, q: 'pikachu' }, 'es')).data
      .items[0];
    expect(es.types).toEqual([{ name: 'electric', label: 'Electric' }]);
    expect(es.imageUrl).toMatch(/\/25\.png$/);
    const fire = (await service.list({ ...page, q: 'cynda' }, 'es')).data
      .items[0];
    expect(fire.types[0].label).toBe('Fuego');
  });

  it('construye el índice una sola vez, aun con peticiones concurrentes', async () => {
    const { service, source } = await setup();
    const results = await Promise.all([
      service.list(page, 'es'),
      service.list(page, 'en'),
      service.filters('es'),
    ]);
    await service.list(page, 'es');
    expect(source.indexCalls).toBe(1);
    expect(results.map((r) => r.hit)).toEqual([false, false, false]);
    expect((await service.list(page, 'es')).hit).toBe(true);
  });
});

describe('PokemonService.filters', () => {
  it('devuelve tipos y generaciones localizados', async () => {
    const { service } = await setup();
    expect(
      (await service.filters('en')).data.generations.map((g) => g.label),
    ).toEqual(['Generation I', 'Generation II']);
    expect((await service.filters('es')).data.types[0]).toEqual({
      name: 'fire',
      label: 'Fuego',
    });
  });
});

describe('PokemonService.detail', () => {
  it('normaliza la clave y cachea por idioma (también los 404)', async () => {
    const { service, source } = await setup();
    expect((await service.detail(' PikaChu ', 'es')).data?.genus).toBe('es');
    expect((await service.detail('pikachu', 'es')).hit).toBe(true);
    expect((await service.detail('pikachu', 'en')).data?.genus).toBe('en');
    expect((await service.detail('missingno', 'es')).data).toBeNull();
    expect((await service.detail('missingno', 'es')).hit).toBe(true);
    expect(source.detailCalls).toBe(3);
  });
});

describe('PokemonService.detail / evolution', () => {
  const lang = 'es';

  it('sin índice en caché no lo espera: pide el detalle sin pista de especie', async () => {
    const { service, source } = await setup();
    await service.detail('pikachu', lang);
    expect(source.hints).toEqual([undefined]);
  });

  it('con el índice resuelve el número y la especie; 25 y pikachu comparten caché', async () => {
    const { service, source } = await setup();
    await service.list({ ...page }, lang); // carga el índice (la primera vez nadie lo tiene en caché)
    const byId = await service.detail('25', lang);
    const byName = await service.detail(' Pikachu ', lang);
    expect(source.detailCalls).toBe(1);
    expect(source.hints).toEqual(['pikachu']);
    expect(byId.hit).toBe(false);
    expect(byName.hit).toBe(true);
  });

  it('una forma usa la especie base como pista', async () => {
    const { service, source } = await setup();
    await service.list({ ...page }, lang);
    await service.detail('10199', lang);
    expect(source.hints).toEqual(['pikachu']);
  });

  it('un nombre fuera del índice sigue consultando la fuente (null cacheado)', async () => {
    const { service, source } = await setup();
    await service.list({ ...page }, lang);
    expect((await service.detail('no-existe', lang)).data).toBeNull();
    await service.detail('no-existe', lang);
    expect(source.detailCalls).toBe(1);
  });

  it('la evolución se cachea aparte y devuelve null si el Pokémon no existe', async () => {
    const { service, source } = await setup();
    await service.list({ ...page }, lang);
    expect((await service.evolution('pikachu', lang)).data?.name).toBe(
      'pikachu',
    );
    expect((await service.evolution('25', lang)).hit).toBe(true);
    expect((await service.evolution('no-existe', lang)).data).toBeNull();
    expect(source.evolutionCalls).toBe(2);
  });

  it('el idioma forma parte de la clave', async () => {
    const { service, source } = await setup();
    await service.detail('pikachu', 'es');
    await service.detail('pikachu', 'en');
    expect(source.detailCalls).toBe(2);
  });

  it('el calentamiento construye el índice y calienta la fuente sin bloquear ni fallar', async () => {
    const { service, source } = await setup();
    service.onApplicationBootstrap();
    await vi.waitFor(() => expect(source.warmCalls).toBe(1));
    await vi.waitFor(() => expect(source.indexCalls).toBe(1));

    const failing = await setup();
    failing.source.warm = async () => {
      throw new Error('PokéAPI caída');
    };
    expect(() => failing.service.onApplicationBootstrap()).not.toThrow();
  });
});

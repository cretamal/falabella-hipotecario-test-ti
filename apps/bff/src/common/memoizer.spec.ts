import { CacheModule } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { Memoizer } from './memoizer.js';

/**
 * Levanta un módulo de Nest con una caché de verdad (en memoria) y nos deja el `Memoizer` listo para probar.
 */
async function setup() {
  const moduleRef = await Test.createTestingModule({
    imports: [CacheModule.register()],
    providers: [Memoizer],
  }).compile();
  return moduleRef.get(Memoizer);
}

afterEach(() => vi.useRealTimers());

describe('Memoizer', () => {
  it('carga una vez, comparte la carga concurrente y cachea null', async () => {
    const memo = await setup();
    let loads = 0;
    /**
     * Carga de mentira: cuenta cuántas veces corre y se demora un poquito, para que las llamadas simultáneas se pisen entre sí.
     */
    const load = async () => {
      loads++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return null;
    };
    const [a, b] = await Promise.all([
      memo.remember('k', 1000, load),
      memo.remember('k', 1000, load),
    ]);
    expect([a.hit, b.hit]).toEqual([false, false]);
    expect((await memo.remember('k', 1000, load)).hit).toBe(true);
    expect(loads).toBe(1);
  });

  it('put y peek: siembran y leen sin cargar', async () => {
    const memo = await setup();
    expect(await memo.peek('x')).toBeUndefined();
    await memo.put('x', { es: 'Hola' }, 1000);
    expect(await memo.peek('x')).toEqual({ es: 'Hola' });
    const { data, hit } = await memo.remember('x', 1000, async () => 'otro');
    expect(data).toEqual({ es: 'Hola' });
    expect(hit).toBe(true);
  });

  describe('con staleMs (stale-while-revalidate)', () => {
    const options = { staleMs: 10_000 };

    it('fresco: acierto sin recargar', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const memo = await setup();
      const load = vi.fn(async () => 'v1');
      await memo.remember('k', 1000, load, options);
      vi.setSystemTime(Date.now() + 500);
      expect((await memo.remember('k', 1000, load, options)).hit).toBe(true);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('obsoleto: sirve el valor guardado y refresca una sola vez en segundo plano', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const memo = await setup();
      let version = 0;
      const load = vi.fn(async () => `v${++version}`);
      await memo.remember('k', 1000, load, options);
      vi.setSystemTime(Date.now() + 2000);

      const [a, b] = await Promise.all([
        memo.remember('k', 1000, load, options),
        memo.remember('k', 1000, load, options),
      ]);
      expect([a.data, b.data]).toEqual(['v1', 'v1']); // entrega el valor vencido al tiro, sin esperar el refresco
      await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
      await vi.waitFor(async () =>
        expect((await memo.remember('k', 1000, load, options)).data).toBe('v2'),
      );
      expect(load).toHaveBeenCalledTimes(2); // y aunque lo pidan varios a la vez, el refresco se hace una sola vez, no pasa nada raro
    });

    it('stale-if-error: si el refresco falla, conserva el valor y lo sigue sirviendo', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const memo = await setup();
      await memo.remember('k', 1000, async () => 'bueno', options);
      vi.setSystemTime(Date.now() + 2000);
      const fail = vi.fn(async () => {
        throw new Error('PokéAPI caída');
      });
      expect((await memo.remember('k', 1000, fail, options)).data).toBe(
        'bueno',
      );
      await vi.waitFor(() => expect(fail).toHaveBeenCalledTimes(1));
      expect((await memo.remember('k', 1000, fail, options)).data).toBe(
        'bueno',
      );
    });

    it('sin entrada guardada, un fallo se propaga', async () => {
      const memo = await setup();
      await expect(
        memo.remember(
          'k',
          1000,
          async () => {
            throw new Error('boom');
          },
          options,
        ),
      ).rejects.toThrow('boom');
    });
  });
});

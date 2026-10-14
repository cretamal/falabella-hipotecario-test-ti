import { KeyvCacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

/**
 * Primer nivel de caché: la memoria del proceso (la comparten la app y los benchmarks).
 * Va sin serialización ni clonado, y no es capricho: Keyv serializaba con JSON en cada lectura y `cacheable` clonaba,
 * lo que costaba ~1,3 ms por lectura del índice (1.350 entradas, medido) y de paso cambiaba la identidad del objeto.
 * Es seguro porque lo cacheado se trata como inmutable (el servicio solo lo lee).
 */
export const memoryStore = (): Keyv =>
  new Keyv({
    store: new KeyvCacheableMemory({ lruSize: 5000, useClone: false }),
    serialization: false,
  });

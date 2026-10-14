import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

/** Lo que nos devuelve la caché: el dato, y si salió de ahí (`hit`) o tuvimos que ir a buscarlo. */
export interface Cached<T> {
  data: T;
  hit: boolean;
}

/** Las opciones que le podemos pasar a `remember` (por ahora, una sola). */
export interface RememberOptions {
  /**
   * Vida física de la entrada (stale-while-revalidate). Pasado `ttlMs` seguimos entregando el valor y lo refrescamos por
   * detrás; si ese refresco falla, nos quedamos con lo que había (stale-if-error). Sin esta opción, la entrada
   * simplemente caduca a los `ttlMs`, sin más.
   */
  staleMs?: number;
}

/** Así queda guardado un valor en el almacén. */
interface Stored<T> {
  v: T;
  /** Solo con `staleMs`: el momento de la carga, para cachar si el valor todavía está fresco. */
  at?: number;
}

/**
 * Caché con carga perezosa. Lo que te asegura:
 *  - las peticiones simultáneas por la misma clave comparten una sola carga (nada de "thundering herd");
 *  - si el almacén falla (por ejemplo, Redis caído) la petición igual sale: acá un fallo del almacén es solo un fallo de caché;
 *  - si quieres, entrega valores vencidos mientras los refresca (`staleMs`).
 * Los valores se guardan envueltos en `{ v }` para poder cachear también `null` (el 404 de PokéAPI).
 */
@Injectable()
export class Memoizer {
  private readonly logger = new Logger(Memoizer.name);
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Entrega el valor de `key`. Si está en caché, lo devuelve al tiro (y, con `staleMs`, lo refresca por detrás cuando ya
   * venció); si no, lo va a buscar con `load`, lo guarda por `ttlMs` y lo devuelve.
   */
  async remember<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
    options: RememberOptions = {},
  ): Promise<Cached<T>> {
    const { staleMs } = options;
    const stored = await this.read<T>(key);
    if (stored) {
      const fresh =
        !staleMs || (stored.at !== undefined && Date.now() - stored.at < ttlMs);
      if (!fresh) {
        this.load(key, ttlMs, load, staleMs).catch((error: unknown) =>
          this.logger.warn(`Refresco fallido (${key}): ${String(error)}`),
        );
      }
      return { data: stored.v, hit: true };
    }
    return { data: await this.load(key, ttlMs, load, staleMs), hit: false };
  }

  /**
   * Echa un vistazo a la caché sin cargar nada: `undefined` si no hay valor (o si el almacén se cae).
   */
  async peek<T>(key: string): Promise<T | undefined> {
    return (await this.read<T>(key))?.v;
  }

  /**
   * Guarda un valor que ya tenemos a mano (por ejemplo, para sembrar etiquetas con datos recién descargados).
   */
  async put<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.write(key, { v: value }, ttlMs);
  }

  /**
   * Ejecuta la carga de verdad y la comparte entre todos los que la piden a la vez; después guarda el resultado. Gracias
   * a esto, 50 usuarios pidiendo lo mismo no terminan siendo 50 consultas a PokéAPI.
   */
  private load<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
    staleMs?: number,
  ): Promise<T> {
    let pending = this.inflight.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = load()
        .then(async (value) => {
          const stored: Stored<T> = staleMs
            ? { v: value, at: Date.now() }
            : { v: value };
          await this.write(key, stored, staleMs ?? ttlMs);
          return value;
        })
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    return pending;
  }

  /**
   * Lectura tolerante: si el almacén falla (por ejemplo, Redis caído) lo dejamos anotado en el log y seguimos como si no
   * hubiera valor. Así una caché enferma no nos tumba la petición.
   */
  private async read<T>(key: string): Promise<Stored<T> | undefined> {
    try {
      return await this.cache.get<Stored<T>>(key);
    } catch (error) {
      this.logger.warn(`Lectura de caché fallida (${key}): ${String(error)}`);
      return undefined;
    }
  }

  /**
   * Escritura tolerante, mismo criterio que `read`: si no se puede guardar, queda una advertencia en el log y no pasa nada más.
   */
  private async write(
    key: string,
    value: unknown,
    ttlMs: number,
  ): Promise<void> {
    try {
      await this.cache.set(key, value, ttlMs);
    } catch (error) {
      this.logger.warn(`Escritura de caché fallida (${key}): ${String(error)}`);
    }
  }
}

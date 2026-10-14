import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { Memoizer } from '../../common/memoizer.js';

/** Cuánto esperamos antes del único reintento de una petición fallida. */
const RETRY_DELAY_MS = 200;

/** Las opciones de `get`. */
export interface GetOptions {
  /**
   * Si se indica, la respuesta se cachea por ese tiempo. Sin él no se cachea (son payloads grandes) y solo se comparte
   * la petición que está en vuelo.
   */
  cacheTtlMs?: number;
}

/**
 * La frontera HTTP con PokéAPI: timeout, un reintento, 404 → `null`, errores → 502 y caché opcional. Todo lo feo de
 * la red queda acá adentro.
 */
@Injectable()
export class PokeApiClient {
  private readonly logger = new Logger(PokeApiClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly inflight = new Map<string, Promise<unknown>>();

  /** Toma de la configuración la URL base y el timeout de PokéAPI. */
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly memo: Memoizer,
  ) {
    const pokeapi = config.get('pokeapi', { infer: true });
    this.baseUrl = pokeapi.baseUrl;
    this.timeoutMs = pokeapi.timeoutMs;
  }

  /**
   * Hace un GET. `pathOrUrl` es una ruta ("/type/fire") o una URL absoluta que entregó la propia PokéAPI; `null` significa 404.
   */
  async get<T>(pathOrUrl: string, options: GetOptions = {}): Promise<T | null> {
    const url = this.resolve(pathOrUrl);
    if (!options.cacheTtlMs)
      return this.shared(url, () => this.fetchJson<T>(url));
    const { data } = await this.memo.remember(
      `pokeapi:${url}`,
      options.cacheTtlMs,
      () => this.fetchJson<T>(url),
    );
    return data;
  }

  /**
   * Las peticiones simultáneas a la misma URL comparten una sola; el resultado no se guarda (solo se evita pedir doble).
   */
  private shared<T>(
    url: string,
    load: () => Promise<T | null>,
  ): Promise<T | null> {
    let pending = this.inflight.get(url) as Promise<T | null> | undefined;
    if (!pending) {
      pending = load().finally(() => this.inflight.delete(url));
      this.inflight.set(url, pending);
    }
    return pending;
  }

  /**
   * Solo seguimos el origen configurado: las URLs vienen de datos externos y no conviene fiarse de ellas.
   */
  private resolve(pathOrUrl: string): string {
    if (!/^https?:\/\//i.test(pathOrUrl)) return `${this.baseUrl}${pathOrUrl}`;
    if (new URL(pathOrUrl).origin !== new URL(this.baseUrl).origin) {
      throw new BadGatewayException('PokéAPI no disponible');
    }
    return pathOrUrl;
  }

  /**
   * Hace la llamada de verdad: aplica el timeout, traduce el 404 a `null`, reintenta una vez ante fallas pasajeras (red,
   * timeout, 429 o 5xx) y convierte cualquier otro problema en un 502, para que el web muestre un error que se pueda
   * reintentar en vez de reventar.
   */
  private async fetchJson<T>(url: string, attempt = 0): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 404) return null;
      if (response.ok) return (await response.json()) as T;
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}`);
      }
      throw new RetryableError(`HTTP ${response.status}`);
    } catch (error) {
      if (
        attempt === 0 &&
        (error instanceof RetryableError || isNetworkError(error))
      ) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.fetchJson<T>(url, 1);
      }
      this.logger.warn(`PokéAPI ${url}: ${String(error)}`);
      throw new BadGatewayException('PokéAPI no disponible');
    }
  }
}

/** Marca los errores HTTP que vale la pena reintentar (429 y 5xx). */
class RetryableError extends Error {}

/** ¿Es una falla de red o un timeout? Esas también las reintentamos una vez. */
const isNetworkError = (error: unknown): boolean =>
  error instanceof TypeError ||
  (error instanceof DOMException && error.name === 'TimeoutError');

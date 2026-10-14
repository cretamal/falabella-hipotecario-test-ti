/**
 * La configuración del BFF: tipada, validada al arrancar y con valores por defecto que funcionan sin tocar nada.
 */
export interface AppConfig {
  port: number;
  /**
   * Lo que se le pasa a `app.set('trust proxy', …)`; `false` si el BFF da la cara directo, sin proxy adelante.
   */
  trustProxy: boolean | number | string;
  pokeapi: { baseUrl: string; timeoutMs: number };
  spritesBaseUrl: string;
  redisUrl?: string;
  cache: {
    indexTtlMs: number;
    detailTtlMs: number;
    /**
     * Vida física del detalle: pasado `detailTtlMs` lo seguimos entregando, vencido, mientras se refresca por detrás.
     */
    detailStaleMs: number;
    labelTtlMs: number;
  };
  throttle: { ttlMs: number; limit: number };
}

/**
 * Lee una variable de entorno entera y positiva. Si no viene, usa el valor por defecto; si viene mala, el arranque
 * falla con un mensaje claro (más vale caerse al tiro que andar con un valor raro).
 */
function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Variable de entorno ${name} inválida: "${raw}" (se espera un entero > 0)`,
    );
  }
  return value;
}

/**
 * Interpreta `TRUST_PROXY`: vacío o `false` es sin proxy; `true`, un número de saltos o una lista de IP o subredes, tal
 * como lo entiende Express. Ojo: los números se pasan como número, no como texto.
 */
function trustProxy(raw: string | undefined): boolean | number | string {
  if (!raw || raw === 'false') return false;
  if (raw === 'true') return true;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

/**
 * Arma la configuración completa a partir de las variables de entorno. Se registra en `ConfigModule` y desde ahí la
 * lee todo el resto.
 */
export const configuration = (): AppConfig => ({
  port: int('PORT', 3000),
  trustProxy: trustProxy(process.env.TRUST_PROXY),
  pokeapi: {
    baseUrl: (
      process.env.POKEAPI_BASE_URL || 'https://pokeapi.co/api/v2'
    ).replace(/\/+$/, ''),
    timeoutMs: int('POKEAPI_TIMEOUT_MS', 5_000),
  },
  spritesBaseUrl: (
    process.env.SPRITES_BASE_URL ||
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
  ).replace(/\/+$/, ''),
  redisUrl: process.env.REDIS_URL || undefined,
  cache: {
    indexTtlMs: int('CACHE_INDEX_TTL_MS', 86_400_000),
    detailTtlMs: int('CACHE_DETAIL_TTL_MS', 86_400_000),
    detailStaleMs: int('CACHE_DETAIL_STALE_MS', 604_800_000),
    labelTtlMs: int('CACHE_LABEL_TTL_MS', 86_400_000),
  },
  throttle: {
    ttlMs: int('THROTTLE_TTL_MS', 60_000),
    limit: int('THROTTLE_LIMIT', 240),
  },
});

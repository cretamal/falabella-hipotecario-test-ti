import type { Params, ParamMap } from '@angular/router';
import type { CatalogQuery } from '@pokedex/contracts';

import { normalizeQuery } from '../../shared/search-query';

/** Cuántos Pokémon se muestran por página. */
export const PAGE_SIZE = 24;

/** El estado del catálogo tal como vive en la URL: `?q=&type=&gen=&page=`. */
export interface CatalogParams {
  q: string;
  type: string;
  generation: number | null;
  page: number;
}

/**
 * Convierte un parámetro de la URL en un entero positivo; si viene vacío o raro, devuelve `null`.
 */
const positiveInt = (raw: string | null): number | null => {
  const value = Number(raw);
  return raw !== null && Number.isInteger(value) && value > 0 ? value : null;
};

/**
 * Lee el estado del catálogo desde la URL y arregla lo que venga malo (página 0, texto con basura, etc.), para que
 * acá adentro nunca circule un valor inválido.
 */
export function parseCatalogParams(map: ParamMap): CatalogParams {
  return {
    q: normalizeQuery(map.get('q') ?? ''),
    type: (map.get('type') ?? '').trim(),
    generation: positiveInt(map.get('gen')),
    page: positiveInt(map.get('page')) ?? 1,
  };
}

/** Arma el query string más cortito posible: lo que está en su valor por defecto ni se escribe. */
export function toQueryParams(params: CatalogParams): Params {
  return {
    q: params.q || null,
    type: params.type || null,
    gen: params.generation,
    page: params.page > 1 ? params.page : null,
  };
}

/**
 * Traduce el estado de la URL a la consulta que entiende el BFF (con `offset` y `limit` incluidos).
 */
export function toApiQuery(params: CatalogParams): CatalogQuery {
  return {
    q: params.q || undefined,
    type: params.type || undefined,
    generation: params.generation ?? undefined,
    offset: (params.page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
}

/**
 * ¿Son iguales dos estados del catálogo? Sirve para no volver a pedir datos cuando la URL cambia pero todo sigue igual.
 */
export const sameCatalogParams = (a: CatalogParams, b: CatalogParams): boolean =>
  a.q === b.q && a.type === b.type && a.generation === b.generation && a.page === b.page;

/** ¿Hay búsqueda o filtros puestos? Decide si se muestra «Limpiar filtros». */
export const hasActiveFilters = (p: CatalogParams): boolean =>
  !!p.q || !!p.type || p.generation !== null;

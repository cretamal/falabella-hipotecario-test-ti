/**
 * Contrato único entre apps/web y apps/bff.
 * Solo tipos: siempre se importa con `import type { … } from '@pokedex/contracts'`.
 */

/** Los idiomas que entiende el BFF y que muestra el web. */
export type Lang = "es" | "en";

/** `name` es la clave estable de PokéAPI; `label` es el texto en el idioma pedido. */
export interface NamedLabel {
  name: string;
  label: string;
}

/** Lo mínimo de un Pokémon para dibujar una tarjeta del catálogo. */
export interface PokemonSummary {
  id: number;
  name: string;
  label: string;
  imageUrl: string;
  types: NamedLabel[];
}

/** Una página de resultados, con el total para poder paginar. */
export interface Page<T> {
  /** Solo viene si no hubo coincidencias exactas y se muestran nombres parecidos. */
  fuzzy?: true;
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Las opciones de los filtros del catálogo: tipos y generaciones ya traducidos. */
export interface CatalogFilters {
  types: NamedLabel[];
  generations: { id: number; label: string }[];
}

/** Un nodo del árbol evolutivo: la etapa y las etapas a las que evoluciona. */
export interface EvolutionNode {
  id: number;
  name: string;
  label: string;
  imageUrl: string;
  /** Ya vienen traducidas: ["Nivel 16"], ["Piedra Trueno"], ["Intercambio"]. */
  conditions: string[];
  evolvesTo: EvolutionNode[];
}

/** Ficha completa de un Pokémon (sin la cadena evolutiva, que se pide aparte). */
export interface PokemonDetail {
  id: number;
  name: string;
  label: string;
  genus: string;
  description: string;
  imageUrl: string;
  /** Miniatura (sprite de 96 px) para mostrar mientras llega `imageUrl`. */
  thumbUrl: string;
  types: NamedLabel[];
  heightM: number;
  weightKg: number;
  abilities: (NamedLabel & { hidden: boolean })[];
  stats: (NamedLabel & { value: number })[];
  generation: { id: number; label: string };
  legendary: boolean;
  mythical: boolean;
}

/** La forma de los errores que devuelve el BFF (la del filtro de excepciones de Nest). */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Parámetros del catálogo; los comparten el query string del BFF y la URL del front. */
export interface CatalogQuery {
  q?: string;
  type?: string;
  generation?: number;
  offset: number;
  limit: number;
}

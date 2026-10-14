import type { EvolutionNode, Lang, PokemonDetail } from '@pokedex/contracts';

/**
 * Etiquetas por idioma. Armamos el índice una sola vez y le sirve a todos los idiomas, así no repetimos pega.
 */
export type Labels = Partial<Record<Lang, string>>;

/**
 * Una fila del índice de Pokémon: lo justo para listar, buscar y filtrar sin tener que ir a pedir cada detalle.
 */
export interface IndexEntry {
  id: number;
  name: string;
  /** Las claves de tipo ("fire"), no sus nombres traducidos. */
  types: string[];
  /** El id de la generación; `null` si no logramos determinarlo. */
  generation: number | null;
  /**
   * Nombre de la especie ('pikachu' para 'pikachu-gmax'). Nos sirve para pedir la especie y el Pokémon a la vez.
   */
  species: string | null;
}

/** El índice completo: todos los Pokémon, más los tipos y las generaciones con sus etiquetas. */
export interface PokemonIndex {
  entries: IndexEntry[];
  types: { name: string; labels: Labels }[];
  generations: { id: number; labels: Labels }[];
}

/**
 * El puerto hacia la fuente externa de datos. La aplicación depende de esta clase abstracta (hace de contrato y de
 * token de DI a la vez) y no tiene idea del adaptador concreto, que vive en `infrastructure/`.
 */
export abstract class PokemonSource {
  /** Trae todos los Pokémon con sus tipos y su generación, ordenados por id. */
  abstract fetchIndex(): Promise<PokemonIndex>;
  /**
   * Detalle sin la cadena evolutiva; `null` si el Pokémon no existe. Lanza `BadGatewayException` si la fuente falla.
   * `speciesHint` (viene del índice) nos permite pedir el Pokémon y su especie en paralelo.
   */
  abstract fetchDetail(
    nameOrId: string,
    lang: Lang,
    speciesHint?: string,
  ): Promise<PokemonDetail | null>;
  /** Trae la cadena evolutiva; `null` si el Pokémon no existe. */
  abstract fetchEvolution(
    nameOrId: string,
    lang: Lang,
    speciesHint?: string,
  ): Promise<EvolutionNode | null>;
  /**
   * Deja listo lo que el detalle va a necesitar (etiquetas, conexiones). Ojo: no debe fallar nunca.
   */
  async warm(): Promise<void> {}
}

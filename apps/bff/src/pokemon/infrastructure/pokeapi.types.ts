/**
 * Las formas (mínimas) de las respuestas de PokéAPI. Solo `infrastructure/` las conoce; el resto ni las ve.
 */

/** Una referencia a otro recurso: su nombre y la URL para pedirlo. */
export interface NamedRef {
  name: string;
  url: string;
}
/** Un nombre traducido a un idioma. */
export interface NameEntry {
  name: string;
  language: { name: string };
}
/** Un listado paginado de recursos (`/pokemon?limit=…`). */
export interface ResourceList {
  results: NamedRef[];
}
/** Un tipo con sus nombres traducidos y los Pokémon que lo tienen. */
export interface RawType {
  names: NameEntry[];
  pokemon: { slot: number; pokemon: NamedRef }[];
}
/** Una generación con sus nombres y las especies que introdujo. */
export interface RawGeneration {
  id: number;
  names: NameEntry[];
  pokemon_species: NamedRef[];
}
/** Cualquier recurso del que solo nos interesan los nombres traducidos (items, triggers, stats). */
export interface RawNamed {
  names: NameEntry[];
}
/** Un Pokémon: medidas, tipos, habilidades, estadísticas base y sprites. */
export interface RawPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: NamedRef }[];
  abilities: { ability: NamedRef; is_hidden: boolean }[];
  stats: { base_stat: number; stat: NamedRef }[];
  species: NamedRef;
  sprites: {
    front_default: string | null;
    other?: { 'official-artwork'?: { front_default: string | null } };
  };
}
/** La especie: nombre, categoría, descripciones, generación y cadena evolutiva. */
export interface RawSpecies {
  id: number;
  names: NameEntry[];
  genera: { genus: string; language: { name: string } }[];
  flavor_text_entries: { flavor_text: string; language: { name: string } }[];
  generation: NamedRef;
  evolution_chain: { url: string };
  is_legendary: boolean;
  is_mythical: boolean;
}
/** Las condiciones concretas de una evolución (nivel, objeto, hora, lugar…). */
export interface RawEvolutionDetail {
  trigger: NamedRef;
  item: NamedRef | null;
  held_item: NamedRef | null;
  min_level: number | null;
  min_happiness: number | null;
  min_affection: number | null;
  min_beauty: number | null;
  time_of_day: string;
  known_move: NamedRef | null;
  known_move_type: NamedRef | null;
  location: NamedRef | null;
  gender: number | null;
  needs_overworld_rain: boolean;
  turn_upside_down: boolean;
  trade_species: NamedRef | null;
  party_species: NamedRef | null;
}
/** Un eslabón de la cadena evolutiva y los eslabones a los que evoluciona. */
export interface RawChainLink {
  species: NamedRef;
  evolution_details: RawEvolutionDetail[];
  evolves_to: RawChainLink[];
}
/** La respuesta de `/evolution-chain/:id`: la raíz de la cadena. */
export interface RawEvolutionChain {
  chain: RawChainLink;
}

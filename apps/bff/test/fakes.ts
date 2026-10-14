import type { EvolutionNode, Lang, PokemonDetail } from '@pokedex/contracts';
import {
  PokemonSource,
  type PokemonIndex,
} from '../src/pokemon/application/pokemon-source.port.js';

/**
 * Índice de prueba: unos pocos Pokémon con tipos y generación, justo lo necesario para probar búsqueda y filtros.
 */
export const INDEX: PokemonIndex = {
  entries: [
    {
      id: 1,
      name: 'bulbasaur',
      species: 'bulbasaur',
      types: ['grass', 'poison'],
      generation: 1,
    },
    {
      id: 4,
      name: 'charmander',
      species: 'charmander',
      types: ['fire'],
      generation: 1,
    },
    {
      id: 6,
      name: 'charizard',
      species: 'charizard',
      types: ['fire', 'flying'],
      generation: 1,
    },
    {
      id: 25,
      name: 'pikachu',
      species: 'pikachu',
      types: ['electric'],
      generation: 1,
    },
    {
      id: 122,
      name: 'mr-mime',
      species: 'mr-mime',
      types: ['psychic', 'fairy'],
      generation: 1,
    },
    {
      id: 155,
      name: 'cyndaquil',
      species: 'cyndaquil',
      types: ['fire'],
      generation: 2,
    },
    {
      id: 10199,
      name: 'pikachu-gmax',
      species: 'pikachu',
      types: ['electric'],
      generation: 1,
    },
  ],
  types: [
    { name: 'fire', labels: { es: 'Fuego', en: 'Fire' } },
    { name: 'electric', labels: { en: 'Electric' } },
  ],
  generations: [
    { id: 1, labels: { es: 'Generación I', en: 'Generation I' } },
    { id: 2, labels: { en: 'Generation II' } },
  ],
};

/** Arma un detalle de mentira del Pokémon pedido, con el texto en el idioma indicado. */
export const detailOf = (name: string, lang: Lang): PokemonDetail => ({
  id: 25,
  name,
  label: name,
  genus: lang,
  description: '',
  imageUrl: '',
  thumbUrl: '',
  types: [],
  heightM: 0.4,
  weightKg: 6,
  abilities: [],
  stats: [],
  generation: { id: 1, label: 'I' },
  legendary: false,
  mythical: false,
});

/** Arma una cadena evolutiva de mentira (Pichu → Pikachu → Raichu). */
export const evolutionOf = (name: string): EvolutionNode => ({
  id: 25,
  name,
  label: name,
  imageUrl: '',
  conditions: [],
  evolvesTo: [],
});

/**
 * Un fake en memoria del puerto: va contando las llamadas para poder comprobar cómo se porta la caché.
 */
export class FakePokemonSource extends PokemonSource {
  indexCalls = 0;
  detailCalls = 0;
  evolutionCalls = 0;
  warmCalls = 0;
  /** Las pistas de especie que le llegaron a `fetchDetail`, en orden. */
  hints: (string | undefined)[] = [];
  /**
   * Entrega el índice de prueba (con una esperita, como lo haría una fuente de verdad) y cuenta la llamada.
   */
  override async fetchIndex() {
    this.indexCalls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return INDEX;
  }
  /**
   * Entrega el detalle solo de Pikachu (el resto "no existe") y anota la pista de especie que le llegó.
   */
  override async fetchDetail(
    nameOrId: string,
    lang: Lang,
    speciesHint?: string,
  ) {
    this.detailCalls++;
    this.hints.push(speciesHint);
    return nameOrId === 'pikachu' ? detailOf(nameOrId, lang) : null;
  }
  /** Entrega la cadena solo de Pikachu; con cualquier otro devuelve `null`. */
  override async fetchEvolution(nameOrId: string) {
    this.evolutionCalls++;
    return nameOrId === 'pikachu' ? evolutionOf(nameOrId) : null;
  }
  /** Solo cuenta que el servicio pidió el calentamiento. */
  override async warm() {
    this.warmCalls++;
  }
}

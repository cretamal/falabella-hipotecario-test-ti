import type {
  CatalogFilters,
  EvolutionNode,
  CatalogQuery,
  Page,
  PokemonDetail,
  PokemonSummary,
} from '@pokedex/contracts';
import { type Observable, of } from 'rxjs';
import { PokemonGateway } from '../src/app/pokemon/application/pokemon-gateway';

/** Un resumen de mentira de un Pokémon, con el tipo que le pidamos. */
export const summary = (id: number, name: string, type = 'fire'): PokemonSummary => ({
  id,
  name,
  label: name[0].toUpperCase() + name.slice(1),
  imageUrl: `https://img.test/${id}.png`,
  types: [{ name: type, label: type }],
});

/** Unos filtros de mentira (dos tipos y dos generaciones). */
export const FILTERS: CatalogFilters = {
  types: [
    { name: 'fire', label: 'Fuego' },
    { name: 'water', label: 'Agua' },
  ],
  generations: [{ id: 1, label: 'Generación I' }],
};

/** Un detalle de mentira (Pikachu). */
export const DETAIL: PokemonDetail = {
  id: 25,
  name: 'pikachu',
  label: 'Pikachu',
  genus: 'Pokémon Ratón',
  description: 'Descripción de prueba.',
  imageUrl: 'https://img.test/25.png',
  thumbUrl: 'https://img.test/thumb/25.png',
  types: [{ name: 'electric', label: 'Eléctrico' }],
  heightM: 0.4,
  weightKg: 6,
  abilities: [
    { name: 'static', label: 'Electricidad Estática', hidden: false },
    { name: 'lightning-rod', label: 'Pararrayos', hidden: true },
  ],
  stats: [
    { name: 'hp', label: 'PS', value: 35 },
    { name: 'speed', label: 'Velocidad', value: 90 },
  ],
  generation: { id: 1, label: 'Generación I' },
  legendary: false,
  mythical: false,
};

/** Una cadena evolutiva de mentira (Pichu → Pikachu → Raichu). */
export const EVOLUTION: EvolutionNode = {
  id: 172,
  name: 'pichu',
  label: 'Pichu',
  imageUrl: '',
  conditions: [],
  evolvesTo: [
    {
      id: 25,
      name: 'pikachu',
      label: 'Pikachu',
      imageUrl: '',
      conditions: ['Amistad 220'],
      evolvesTo: [
        {
          id: 26,
          name: 'raichu',
          label: 'Raichu',
          imageUrl: '',
          conditions: ['Piedra Trueno'],
          evolvesTo: [],
        },
      ],
    },
  ],
};

/** Un fake en memoria del puerto: cada test le cambia el comportamiento que necesita. */
export class FakeGateway extends PokemonGateway {
  queries: CatalogQuery[] = [];
  /** Cómo responde `list`; cada test lo cambia según lo que quiera probar. */
  listImpl: (q: CatalogQuery) => Observable<Page<PokemonSummary>> = (q) =>
    of({
      items: [summary(4, 'charmander'), summary(6, 'charizard')],
      total: 2,
      offset: q.offset,
      limit: q.limit,
    });
  /** Cómo responde `detail` (por defecto, el Pikachu de mentira). */
  detailImpl: (name: string | number) => Observable<PokemonDetail> = () => of(DETAIL);
  /** Cómo responde `evolution` (por defecto, la cadena Pichu → Pikachu → Raichu). */
  evolutionImpl: (name: string | number) => Observable<EvolutionNode> = () => of(EVOLUTION);
  prefetched: string[] = [];

  /**
   * Anota la consulta que llegó (para revisarla en el test) y responde con la implementación configurada.
   */
  list(query: CatalogQuery) {
    this.queries.push(query);
    return this.listImpl(query);
  }
  /** Responde con los filtros de mentira. */
  filters() {
    return of(FILTERS);
  }
  /** Responde con la implementación de detalle que dejó configurada el test. */
  detail(nameOrId: string | number) {
    return this.detailImpl(nameOrId);
  }
  /** Responde con la implementación de evolución que dejó configurada el test. */
  evolution(nameOrId: string | number) {
    return this.evolutionImpl(nameOrId);
  }
  /** Solo anota qué Pokémon se pidió precargar. */
  override prefetchDetail(nameOrId: string) {
    this.prefetched.push(nameOrId);
  }
}

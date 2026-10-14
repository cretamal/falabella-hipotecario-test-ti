import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EvolutionNode,
  Lang,
  NamedLabel,
  PokemonDetail,
} from '@pokedex/contracts';
import type { AppConfig } from '../../config/configuration.js';
import { Memoizer } from '../../common/memoizer.js';
import { cleanText, formatName } from '../../common/text.js';
import type {
  IndexEntry,
  Labels,
  PokemonIndex,
  PokemonSource,
} from '../application/pokemon-source.port.js';
import { describeEvolution } from './evolution-conditions.js';
import { PokeApiClient } from './pokeapi.client.js';
import type {
  NameEntry,
  RawChainLink,
  RawEvolutionChain,
  RawGeneration,
  RawNamed,
  RawPokemon,
  RawSpecies,
  RawType,
  ResourceList,
} from './pokeapi.types.js';

/** Los idiomas de los que guardamos etiquetas. */
const LANGS: Lang[] = ['es', 'en'];
/** Saca el id numérico del final de una URL de PokéAPI (`…/pokemon/25/` → 25). */
const idFromUrl = (url: string): number =>
  Number(url.replace(/\/+$/, '').split('/').pop());

/** Se queda solo con las etiquetas de los idiomas que usamos (es y en). */
const labelsOf = (names: NameEntry[]): Labels => {
  const labels: Labels = {};
  for (const lang of LANGS) {
    const found = names.find((n) => n.language.name === lang);
    if (found) labels[lang] = found.name;
  }
  return labels;
};

/**
 * Elige el nombre en el idioma pedido; si falta, cae a inglés y, de último recurso, al texto de respaldo.
 */
const pickLabel = (names: NameEntry[], lang: Lang, fallback: string): string =>
  names.find((n) => n.language.name === lang)?.name ??
  names.find((n) => n.language.name === 'en')?.name ??
  fallback;

/** Las seis estadísticas base, en el orden en que se muestran. */
const STAT_NAMES = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
];

/**
 * Toma el último texto en el idioma pedido (los más nuevos vienen al final); si no hay, usa el inglés.
 */
const pickText = <K extends string>(
  entries: ({ language: { name: string } } & Record<K, string>)[],
  key: K,
  lang: Lang,
): string => {
  const inLang = entries.filter((e) => e.language.name === lang);
  const pool = inLang.length
    ? inLang
    : entries.filter((e) => e.language.name === 'en');
  return pool.length ? cleanText(pool[pool.length - 1][key]) : '';
};

/**
 * Adaptador: traduce lo que entrega PokéAPI al modelo de la aplicación. Es el único lugar que sabe cómo vienen esos
 * datos; el resto del BFF ni se entera.
 */
@Injectable()
export class PokeApiSource implements PokemonSource {
  private readonly spritesBaseUrl: string;
  private readonly labelTtlMs: number;

  /** Toma de la configuración la URL de los sprites y cuánto viven las etiquetas en caché. */
  constructor(
    private readonly api: PokeApiClient,
    private readonly memo: Memoizer,
    config: ConfigService<AppConfig, true>,
  ) {
    this.spritesBaseUrl = config.get('spritesBaseUrl', { infer: true });
    this.labelTtlMs = config.get('cache', { infer: true }).labelTtlMs;
  }

  // Índice: ~30 llamadas (lista + tipos + generaciones)

  /**
   * Construye el índice completo: lista de Pokémon, tipos y generaciones. Son unas 30 llamadas en paralelo que, de paso,
   * siembran las etiquetas en caché para que después el detalle no tenga que pedirlas de nuevo.
   */
  async fetchIndex(): Promise<PokemonIndex> {
    const [list, typeList, generationList] = await Promise.all([
      this.required<ResourceList>('/pokemon?limit=100000'),
      this.required<ResourceList>('/type?limit=100'),
      this.required<ResourceList>('/generation?limit=100'),
    ]);
    const [rawTypes, rawGenerations] = await Promise.all([
      Promise.all(
        typeList.results.map((t) => this.required<RawType>(`/type/${t.name}`)),
      ),
      Promise.all(
        generationList.results.map((g) =>
          this.required<RawGeneration>(`/generation/${g.name}`),
        ),
      ),
    ]);

    // El detalle usa estas mismas etiquetas de tipos y generaciones: las sembramos ahora para ahorrar llamadas después.
    await Promise.all([
      ...typeList.results.map((ref, i) =>
        this.memo.put(
          this.labelKey('type', ref.name),
          labelsOf(rawTypes[i].names),
          this.labelTtlMs,
        ),
      ),
      ...generationList.results.map((ref, i) =>
        this.memo.put(
          this.labelKey('generation', ref.name),
          labelsOf(rawGenerations[i].names),
          this.labelTtlMs,
        ),
      ),
    ]);

    const slotsByPokemon = new Map<string, { slot: number; type: string }[]>();
    typeList.results.forEach((ref, i) => {
      for (const { slot, pokemon } of rawTypes[i].pokemon) {
        const slots = slotsByPokemon.get(pokemon.name) ?? [];
        slots.push({ slot, type: ref.name });
        slotsByPokemon.set(pokemon.name, slots);
      }
    });

    const generationBySpecies = new Map<string, number>();
    for (const generation of rawGenerations) {
      for (const species of generation.pokemon_species)
        generationBySpecies.set(species.name, generation.id);
    }

    const entries: IndexEntry[] = list.results
      .map((ref) => {
        const species = speciesOf(ref.name, generationBySpecies);
        return {
          id: idFromUrl(ref.url),
          name: ref.name,
          types: (slotsByPokemon.get(ref.name) ?? [])
            .sort((a, b) => a.slot - b.slot)
            .map((s) => s.type),
          generation: species
            ? (generationBySpecies.get(species) ?? null)
            : null,
          species,
        };
      })
      .sort((a, b) => a.id - b.id);

    return {
      entries,
      types: typeList.results
        .map((ref, i) => ({
          name: ref.name,
          labels: labelsOf(rawTypes[i].names),
          count: rawTypes[i].pokemon.length,
        }))
        .filter((t) => t.count > 0)
        .map(({ name, labels }) => ({ name, labels })),
      generations: rawGenerations
        .map((g) => ({ id: g.id, labels: labelsOf(g.names) }))
        .sort((a, b) => a.id - b.id),
    };
  }

  // Detalle (núcleo) y evolución: peticiones independientes

  /**
   * Calienta las etiquetas de estadísticas (son las mismas para todos los Pokémon, así que se hace una vez).
   */
  async warm(): Promise<void> {
    await Promise.allSettled(
      STAT_NAMES.map((name) => this.labels('stat', name)),
    );
  }

  /**
   * Arma el detalle de un Pokémon (sin la evolución). Con pista de especie pide Pokémon y especie en paralelo, y resuelve
   * en paralelo las etiquetas de tipos, habilidades, estadísticas y generación. Devuelve `null` si el Pokémon no existe.
   */
  async fetchDetail(
    nameOrId: string,
    lang: Lang,
    speciesHint?: string,
  ): Promise<PokemonDetail | null> {
    const [pokemon, hinted] = await Promise.all([
      this.api.get<RawPokemon>(`/pokemon/${encodeURIComponent(nameOrId)}`),
      this.hintedSpecies(speciesHint),
    ]);
    if (!pokemon) return null;
    const species = await this.speciesFor(pokemon, hinted);

    const [types, abilities, stats, generation] = await Promise.all([
      Promise.all(
        pokemon.types.map((t) => this.namedLabel('type', t.type.name, lang)),
      ),
      Promise.all(
        pokemon.abilities.map(async (a) => ({
          ...(await this.namedLabel('ability', a.ability.name, lang)),
          hidden: a.is_hidden,
        })),
      ),
      Promise.all(
        pokemon.stats.map(async (s) => ({
          ...(await this.namedLabel('stat', s.stat.name, lang)),
          value: s.base_stat,
        })),
      ),
      this.namedLabel('generation', species.generation.name, lang),
    ]);

    return {
      id: pokemon.id,
      name: pokemon.name,
      label: pickLabel(species.names, lang, formatName(pokemon.name)),
      genus: pickText(species.genera, 'genus', lang),
      description: pickText(species.flavor_text_entries, 'flavor_text', lang),
      imageUrl:
        pokemon.sprites.other?.['official-artwork']?.front_default ??
        pokemon.sprites.front_default ??
        `${this.spritesBaseUrl}/${pokemon.id}.png`,
      thumbUrl: `${this.spritesBaseUrl}/${pokemon.id}.png`,
      types,
      heightM: pokemon.height / 10,
      weightKg: pokemon.weight / 10,
      abilities,
      stats,
      generation: {
        id: idFromUrl(species.generation.url),
        label: generation.label,
      },
      legendary: species.is_legendary,
      mythical: species.is_mythical,
    };
  }

  /**
   * Arma el árbol evolutivo completo del Pokémon. Va en una petición aparte del detalle para que la ficha no se quede
   * esperándolo. Devuelve `null` si el Pokémon no existe.
   */
  async fetchEvolution(
    nameOrId: string,
    lang: Lang,
    speciesHint?: string,
  ): Promise<EvolutionNode | null> {
    let species = await this.hintedSpecies(speciesHint);
    if (!species) {
      const pokemon = await this.api.get<RawPokemon>(
        `/pokemon/${encodeURIComponent(nameOrId)}`,
      );
      if (!pokemon) return null;
      species = await this.speciesFor(pokemon, null);
    }
    const chain = await this.required<RawEvolutionChain>(
      species.evolution_chain.url,
    );
    return this.evolutionNode(chain.chain, lang);
  }

  /**
   * La especie se pide en paralelo con el Pokémon; si falla, no pasa nada: se cae al camino secuencial.
   */
  private async hintedSpecies(hint?: string): Promise<RawSpecies | null> {
    if (!hint) return null;
    try {
      return await this.api.get<RawSpecies>(
        `/pokemon-species/${encodeURIComponent(hint)}`,
      );
    } catch {
      return null;
    }
  }

  /**
   * La especie que viene por pista solo sirve si es la del Pokémon (el índice puede estar desfasado, ojo).
   */
  private async speciesFor(
    pokemon: RawPokemon,
    hinted: RawSpecies | null,
  ): Promise<RawSpecies> {
    if (hinted && hinted.id === idFromUrl(pokemon.species.url)) return hinted;
    return this.required<RawSpecies>(pokemon.species.url);
  }

  /**
   * Convierte un eslabón de la cadena en un nodo del contrato, resolviendo en paralelo sus condiciones traducidas y sus
   * ramas (es recursivo).
   */
  private async evolutionNode(
    link: RawChainLink,
    lang: Lang,
  ): Promise<EvolutionNode> {
    const id = idFromUrl(link.species.url);
    const [conditions, evolvesTo] = await Promise.all([
      describeEvolution(link.evolution_details, lang, (resource, name) =>
        this.namedLabel(resource, name, lang).then((l) => l.label),
      ),
      Promise.all(
        link.evolves_to.map((next) => this.evolutionNode(next, lang)),
      ),
    ]);
    return {
      id,
      name: link.species.name,
      label: formatName(link.species.name),
      imageUrl: `${this.spritesBaseUrl}/${id}.png`,
      conditions,
      evolvesTo,
    };
  }

  // Utilidades

  /** La clave de caché de las etiquetas de un recurso (`label:type:fire`). */
  private labelKey(resource: string, name: string): string {
    return `label:${resource}:${name}`;
  }

  /**
   * Guarda solo las etiquetas por idioma (unos pocos bytes): el JSON completo del recurso ni se almacena.
   */
  private async labels(resource: string, name: string): Promise<Labels | null> {
    const { data } = await this.memo.remember(
      this.labelKey(resource, name),
      this.labelTtlMs,
      async () => {
        const raw = await this.api.get<RawNamed>(
          `/${resource}/${encodeURIComponent(name)}`,
        );
        return raw ? labelsOf(raw.names) : null;
      },
    );
    return data;
  }

  /**
   * Etiqueta traducida de un recurso con `names[]`; si PokéAPI no responde, usa la clave formateada y listo.
   */
  private async namedLabel(
    resource: string,
    name: string,
    lang: Lang,
  ): Promise<NamedLabel> {
    try {
      const labels = await this.labels(resource, name);
      return { name, label: labels?.[lang] ?? labels?.en ?? formatName(name) };
    } catch {
      return { name, label: formatName(name) };
    }
  }

  /**
   * Para recursos que sí o sí tienen que existir: un 404 acá es una inconsistencia de la fuente.
   */
  private async required<T>(pathOrUrl: string): Promise<T> {
    const value = await this.api.get<T>(pathOrUrl);
    if (value === null) throw new BadGatewayException('PokéAPI no disponible');
    return value;
  }
}

/**
 * Deduce la especie de una forma alternativa ("mr-mime-galar" → "mr-mime", "pikachu-gmax" → "pikachu"), probando los
 * prefijos de más largo a más corto contra las especies que conocemos.
 */
function speciesOf(
  name: string,
  bySpecies: Map<string, number>,
): string | null {
  const parts = name.split('-');
  for (let length = parts.length; length >= 1; length--) {
    const species = parts.slice(0, length).join('-');
    if (bySpecies.has(species)) return species;
  }
  return null;
}

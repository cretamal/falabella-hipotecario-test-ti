import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CatalogFilters,
  EvolutionNode,
  CatalogQuery,
  Lang,
  Page,
  PokemonDetail,
  PokemonSummary,
} from '@pokedex/contracts';
import type { AppConfig } from '../../config/configuration.js';
import { type Cached, Memoizer } from '../../common/memoizer.js';
import { formatName } from '../../common/text.js';
import {
  type Labels,
  type PokemonIndex,
  PokemonSource,
} from './pokemon-source.port.js';
import {
  buildSearchEntries,
  parseQuery,
  search,
  type SearchEntry,
} from './search.js';

/** Tope de resultados por página: así nadie nos pide el catálogo completo de una. */
export const MAX_LIMIT = 60;
/** La clave de caché del índice completo de Pokémon. */
const INDEX_KEY = 'pokemon:index';

/**
 * Datos derivados del índice. Los calculamos una sola vez por índice, no cada vez que alguien pide algo.
 */
interface Prepared {
  entries: SearchEntry[];
  byName: Map<string, SearchEntry>;
  byId: Map<number, SearchEntry>;
  typeLabels: Partial<Record<Lang, Map<string, string>>>;
}

/**
 * Elige la etiqueta en el idioma pedido; si no existe, cae a inglés y, de último recurso, al texto de respaldo.
 */
const pick = (labels: Labels, lang: Lang, fallback: string): string =>
  labels[lang] ?? labels.en ?? fallback;

/**
 * Casos de uso del catálogo: listar y buscar, entregar los filtros, y entregar el detalle y la evolución. Ojo con los
 * límites: acá no se sabe nada de PokéAPI (se conversa con el puerto `PokemonSource`) ni de HTTP (eso le toca al
 * controlador).
 */
@Injectable()
export class PokemonService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PokemonService.name);
  private readonly indexTtl: number;
  private readonly detailTtl: number;
  private readonly detailStale: number;
  private readonly spritesBaseUrl: string;
  private readonly prepared = new WeakMap<PokemonIndex, Prepared>();

  /** Lee de la configuración los tiempos de caché y la URL base de los sprites. */
  constructor(
    private readonly source: PokemonSource,
    private readonly memo: Memoizer,
    config: ConfigService<AppConfig, true>,
  ) {
    this.indexTtl = config.get('cache', { infer: true }).indexTtlMs;
    this.detailTtl = config.get('cache', { infer: true }).detailTtlMs;
    this.detailStale = config.get('cache', { infer: true }).detailStaleMs;
    this.spritesBaseUrl = config.get('spritesBaseUrl', { infer: true });
  }

  /**
   * Entrega una página del catálogo. Busca y filtra sobre el índice que ya está en memoria (sin tocar PokéAPI), ordena
   * por relevancia, recorta según `offset` y `limit` y arma los resúmenes con los tipos ya traducidos.
   */
  async list(
    query: CatalogQuery,
    lang: Lang,
  ): Promise<Cached<Page<PokemonSummary>>> {
    const { data: index, hit } = await this.index();
    const prepared = this.prepare(index);
    const labelOfType = this.typeLabels(index, prepared, lang);
    const limit = Math.min(Math.max(query.limit, 1), MAX_LIMIT);
    const offset = Math.max(query.offset, 0);

    const { matches, fuzzy } = search(
      prepared.entries,
      parseQuery(query.q),
      query,
    );

    return {
      hit,
      data: {
        ...(fuzzy && { fuzzy: true as const }),
        total: matches.length,
        offset,
        limit,
        items: matches.slice(offset, offset + limit).map((entry) => ({
          id: entry.id,
          name: entry.name,
          label: formatName(entry.name),
          imageUrl: `${this.spritesBaseUrl}/${entry.id}.png`,
          types: entry.types.map((name) => ({
            name,
            label: labelOfType.get(name) ?? formatName(name),
          })),
        })),
      },
    };
  }

  /**
   * Devuelve las estructuras derivadas del índice (claves de búsqueda y mapas por nombre y por id). Las calcula la
   * primera vez y de ahí en adelante las reutiliza.
   */
  private prepare(index: PokemonIndex): Prepared {
    let prepared = this.prepared.get(index);
    if (!prepared) {
      const entries = buildSearchEntries(index.entries);
      prepared = {
        entries,
        byName: new Map(entries.map((e) => [e.name, e])),
        byId: new Map(entries.map((e) => [e.id, e])),
        typeLabels: {},
      };
      this.prepared.set(index, prepared);
    }
    return prepared;
  }

  /**
   * Mapa nombre-de-tipo → etiqueta para un idioma; se arma una sola vez por índice e idioma y ahí se queda.
   */
  private typeLabels(
    index: PokemonIndex,
    prepared: Prepared,
    lang: Lang,
  ): Map<string, string> {
    return (prepared.typeLabels[lang] ??= new Map(
      index.types.map((t) => [
        t.name,
        pick(t.labels, lang, formatName(t.name)),
      ]),
    ));
  }

  /** Entrega los tipos y generaciones para filtrar, con su etiqueta en el idioma pedido. */
  async filters(lang: Lang): Promise<Cached<CatalogFilters>> {
    const { data: index, hit } = await this.index();
    return {
      hit,
      data: {
        types: index.types.map((t) => ({
          name: t.name,
          label: pick(t.labels, lang, formatName(t.name)),
        })),
        generations: index.generations.map((g) => ({
          id: g.id,
          label: pick(g.labels, lang, `#${g.id}`),
        })),
      },
    };
  }

  /**
   * Calentamiento al arrancar, sin bloquear el arranque ni `/api/health`: arma el índice (de paso abre las conexiones a
   * PokéAPI) y las etiquetas de estadísticas. Si algo falla no pasa nada, el servicio igual parte.
   */
  onApplicationBootstrap(): void {
    void Promise.allSettled([this.index(), this.source.warm()]).then(
      (results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed)
          this.logger.warn(`Calentamiento incompleto (${failed} fallos)`);
        else this.logger.log('Calentamiento listo');
      },
    );
  }

  /**
   * `data` es `null` cuando el Pokémon no existe (eso también lo cacheamos, para no seguir molestando a PokéAPI).
   */
  async detail(
    nameOrId: string,
    lang: Lang,
  ): Promise<Cached<PokemonDetail | null>> {
    const { name, species } = await this.resolve(nameOrId);
    return this.memo.remember(
      `pokemon:v2:detail:${lang}:${name}`,
      this.detailTtl,
      () => this.source.fetchDetail(name, lang, species),
      { staleMs: this.detailStale },
    );
  }

  /** La cadena evolutiva; `null` cuando el Pokémon no existe. */
  async evolution(
    nameOrId: string,
    lang: Lang,
  ): Promise<Cached<EvolutionNode | null>> {
    const { name, species } = await this.resolve(nameOrId);
    return this.memo.remember(
      `pokemon:v2:evolution:${lang}:${name}`,
      this.detailTtl,
      () => this.source.fetchEvolution(name, lang, species),
      { staleMs: this.detailStale },
    );
  }

  /**
   * Resuelve nombre o número usando el índice, pero solo si ya está en caché (nunca lo esperamos). Así `25` y
   * `pikachu` comparten entrada de caché, y la especie nos deja pedir el Pokémon y su especie en paralelo.
   */
  private async resolve(
    nameOrId: string,
  ): Promise<{ name: string; species?: string }> {
    const key = nameOrId.trim().toLowerCase();
    const index = await this.memo.peek<PokemonIndex>(INDEX_KEY);
    if (!index) {
      void this.index().catch(() => undefined); // lo dejamos cargando para que la próxima vez ya lo encuentre
      return { name: key };
    }
    const { byName, byId } = this.prepare(index);
    const entry = /^\d+$/.test(key) ? byId.get(Number(key)) : byName.get(key);
    return entry
      ? { name: entry.name, species: entry.species ?? undefined }
      : { name: key };
  }

  /**
   * Obtiene el índice completo desde la caché; si no está, lo arma una sola vez aunque lo pidan varios al mismo tiempo.
   */
  private index(): Promise<Cached<PokemonIndex>> {
    return this.memo.remember(INDEX_KEY, this.indexTtl, () =>
      this.source.fetchIndex(),
    );
  }
}

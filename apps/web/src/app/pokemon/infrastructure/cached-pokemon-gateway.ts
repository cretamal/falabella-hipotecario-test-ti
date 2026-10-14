import { Injectable, inject } from '@angular/core';
import type {
  CatalogFilters,
  CatalogQuery,
  EvolutionNode,
  Page,
  PokemonDetail,
  PokemonSummary,
} from '@pokedex/contracts';
import {
  EMPTY,
  type Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { searchKey } from '../../shared/search-query';
import { PokemonGateway } from '../application/pokemon-gateway';
import { HttpPokemonGateway } from './http-pokemon-gateway';

/** Cuántas páginas de catálogo nos acordamos. */
export const LIST_CACHE_SIZE = 30;
/**
 * Cuántos detalles y evoluciones nos acordamos (alcanza para una cadena ancha como la de Eevee más lo ya visto).
 */
export const DETAIL_CACHE_SIZE = 30;
/**
 * Alineado con el `Cache-Control: max-age=300` del catálogo; el detalle casi no cambia, pero igual lo dejamos corto.
 */
export const CACHE_TTL_MS = 5 * 60_000;
/**
 * Máximo de precargas simultáneas: un detalle en frío le cuesta varias llamadas a PokéAPI al BFF.
 */
export const MAX_PREFETCH = 2;

/** Una entrada de la caché: cuándo se guardó y el observable compartido con su valor. */
interface Entry<T> {
  at: number;
  value$: Observable<T>;
}

/**
 * Una LRU con TTL de observables compartidos:
 *  - las peticiones simultáneas por la misma clave comparten una sola (`shareReplay`);
 *  - un error nunca se guarda (si no, quedaríamos pegados con él).
 */
class Lru<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly size: number) {}

  /** ¿Hay un valor vigente (no vencido) para esta clave? */
  has(key: string): boolean {
    return this.fresh(key) !== undefined;
  }

  /**
   * Entrega el valor de la clave: el cacheado si sigue vigente (y lo marca como el más reciente) o, si no, lo pide con
   * `request`, compartiéndolo entre todos los que lo piden a la vez. Los errores no se guardan.
   */
  load(key: string, request: () => Observable<T>): Observable<T> {
    const cached = this.fresh(key);
    if (cached) {
      this.entries.delete(key); // se vuelve a insertar para que quede como el más reciente
      this.entries.set(key, cached);
      return cached.value$;
    }
    const value$ = request().pipe(
      catchError((error: unknown) => {
        this.entries.delete(key);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.put(key, value$);
    return value$;
  }

  /**
   * Guarda un valor que ya tenemos a mano (sin tocar la red), salvo que la clave ya tenga uno vigente.
   */
  seed(key: string, value$: Observable<T>): void {
    if (!this.fresh(key)) this.put(key, value$);
  }

  /** Guarda el observable y, si nos pasamos del tamaño, bota la entrada más antigua. */
  private put(key: string, value$: Observable<T>): void {
    this.entries.set(key, { at: Date.now(), value$ });
    if (this.entries.size > this.size) this.entries.delete(this.entries.keys().next().value!);
  }

  /** Devuelve la entrada solo si todavía no vence su TTL. */
  private fresh(key: string): Entry<T> | undefined {
    const entry = this.entries.get(key);
    return entry && Date.now() - entry.at < CACHE_TTL_MS ? entry : undefined;
  }
}

/** ¿El usuario activó el ahorro de datos del navegador? Si es así, no precargamos nada. */
const saveData = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

/**
 * Baja el artwork a la caché del navegador para que la ficha no pegue un salto cuando llegue la imagen.
 */
function preloadImage(url: string): void {
  if (url && typeof Image !== 'undefined') new Image().src = url;
}

/**
 * Adaptador decorador: cachea y precarga por delante del adaptador HTTP.
 *  - clave canónica en las búsquedas (`Pika`, `pika ` y `PIKA` comparten entrada);
 *  - lo ya visto (lista, detalle, evolución, filtros) no vuelve a la red mientras dure el TTL;
 *  - `prefetchDetail`: máximo `MAX_PREFETCH` en vuelo, 1 por Pokémon y nada con `saveData`; al llegar baja el artwork;
 *  - la cadena evolutiva cargada se siembra bajo el id y el nombre de cada etapa (abrir otra etapa = 0 peticiones).
 * Vive en el inyector de la aplicación: en SSR hay una instancia por petición, así que nada se mezcla entre visitantes.
 */
@Injectable()
export class CachedPokemonGateway extends PokemonGateway {
  private readonly inner = inject(HttpPokemonGateway);
  private readonly lists = new Lru<Page<PokemonSummary>>(LIST_CACHE_SIZE);
  private readonly filtersCache = new Lru<CatalogFilters>(1);
  private readonly details = new Lru<PokemonDetail>(DETAIL_CACHE_SIZE);
  private readonly evolutions = new Lru<EvolutionNode>(DETAIL_CACHE_SIZE);

  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  private active = 0;

  /** El catálogo con caché: la clave es canónica (`Pika`, `pika ` y `PIKA` comparten entrada). */
  list(query: CatalogQuery): Observable<Page<PokemonSummary>> {
    const key = [
      searchKey(query.q ?? ''),
      query.type ?? '',
      query.generation ?? '',
      query.offset,
      query.limit,
    ].join('|');
    return this.lists.load(key, () => this.inner.list(query));
  }

  /** Los filtros con caché (casi nunca cambian). */
  filters(): Observable<CatalogFilters> {
    return this.filtersCache.load('filters', () => this.inner.filters());
  }

  /** El detalle con caché: lo ya visto no vuelve a la red mientras dure el TTL. */
  detail(nameOrId: string | number): Observable<PokemonDetail> {
    const key = String(nameOrId).toLowerCase();
    return this.details.load(key, () => this.inner.detail(nameOrId));
  }

  /** La evolución con caché; además se siembra para todas las etapas de la cadena. */
  evolution(nameOrId: string | number): Observable<EvolutionNode> {
    const key = String(nameOrId).toLowerCase();
    return this.evolutions.load(key, () =>
      this.inner.evolution(nameOrId).pipe(tap((root) => this.seedEvolution(root))),
    );
  }

  /**
   * Pide el detalle por adelantado (cursor sobre una tarjeta, etapas vecinas). Respeta el ahorro de datos, no repite
   * lo que ya se pidió y deja la solicitud en la cola de precargas.
   */
  override prefetchDetail(nameOrId: string): void {
    const key = nameOrId.toLowerCase();
    if (saveData() || this.details.has(key) || this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push(key);
    this.pump();
  }

  /** Toda la cadena comparte el mismo árbol: abrir otra etapa no lo vuelve a pedir. */
  private seedEvolution(node: EvolutionNode): void {
    /** Recorre el árbol sembrando la cadena completa bajo el id y el nombre de cada etapa. */
    const walk = (n: EvolutionNode, root: EvolutionNode) => {
      this.evolutions.seed(String(n.id), of(root));
      this.evolutions.seed(n.name, of(root));
      n.evolvesTo.forEach((child) => walk(child, root));
    };
    walk(node, node);
  }

  /**
   * Saca de la cola las precargas que caben (máximo dos en vuelo) y las ejecuta. Si una falla no pasa nada: se vuelve a
   * pedir cuando el usuario abra ese Pokémon.
   */
  private pump(): void {
    while (this.active < MAX_PREFETCH && this.queue.length) {
      const key = this.queue.shift()!;
      this.active++;
      this.detail(key)
        .pipe(
          tap(({ imageUrl }) => preloadImage(imageUrl)),
          catchError(() => EMPTY), // una precarga fallida no molesta: se pedirá al abrir
          finalize(() => {
            this.active--;
            this.queued.delete(key);
            this.pump();
          }),
        )
        .subscribe();
    }
  }
}

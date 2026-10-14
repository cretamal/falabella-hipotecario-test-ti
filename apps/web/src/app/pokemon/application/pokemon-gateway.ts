import type {
  CatalogFilters,
  CatalogQuery,
  EvolutionNode,
  Page,
  PokemonDetail,
  PokemonSummary,
} from '@pokedex/contracts';
import type { Observable } from 'rxjs';

/**
 * El puerto hacia los datos de Pokémon. Las páginas dependen de esta clase abstracta (hace de contrato y de token de
 * DI a la vez) y jamás de HttpClient; el adaptador se elige en app.config.ts.
 */
export abstract class PokemonGateway {
  /** Pide una página del catálogo según búsqueda, filtros y paginación. */
  abstract list(query: CatalogQuery): Observable<Page<PokemonSummary>>;
  /** Pide los tipos y generaciones disponibles para filtrar. */
  abstract filters(): Observable<CatalogFilters>;
  /** Emite un `HttpErrorResponse` con status 404 si no existe. */
  abstract detail(nameOrId: string | number): Observable<PokemonDetail>;
  /** La cadena evolutiva (va en una petición aparte: el detalle no se queda esperándola). */
  abstract evolution(nameOrId: string | number): Observable<EvolutionNode>;
  /** Pide el detalle por adelantado (por ejemplo, al pasar el cursor); por defecto no hace nada. */
  prefetchDetail(nameOrId: string): void {
    void nameOrId;
  }
}

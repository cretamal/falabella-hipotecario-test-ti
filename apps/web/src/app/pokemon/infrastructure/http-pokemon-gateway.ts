import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import type {
  CatalogFilters,
  CatalogQuery,
  EvolutionNode,
  Lang,
  Page,
  PokemonDetail,
  PokemonSummary,
} from '@pokedex/contracts';
import type { Observable } from 'rxjs';
import { PokemonGateway } from '../application/pokemon-gateway';

const API = '/api';

/**
 * Adaptador: conversa con el BFF por HTTP y le agrega el idioma activo (`LOCALE_ID`) a cada petición.
 */
@Injectable()
export class HttpPokemonGateway extends PokemonGateway {
  private readonly http = inject(HttpClient);
  private readonly lang: Lang = inject(LOCALE_ID).startsWith('en') ? 'en' : 'es';

  /** Le pide una página del catálogo al BFF, en el idioma activo. */
  list(query: CatalogQuery): Observable<Page<PokemonSummary>> {
    let params = new HttpParams()
      .set('offset', query.offset)
      .set('limit', query.limit)
      .set('lang', this.lang);
    if (query.q) params = params.set('q', query.q);
    if (query.type) params = params.set('type', query.type);
    if (query.generation) params = params.set('generation', query.generation);
    return this.http.get<Page<PokemonSummary>>(`${API}/pokemon`, { params });
  }

  /** Le pide los tipos y generaciones al BFF. */
  filters(): Observable<CatalogFilters> {
    return this.http.get<CatalogFilters>(`${API}/filters`, { params: { lang: this.lang } });
  }

  /** Le pide el detalle de un Pokémon al BFF (404 si no existe). */
  detail(nameOrId: string | number): Observable<PokemonDetail> {
    return this.http.get<PokemonDetail>(`${API}/pokemon/${encodeURIComponent(nameOrId)}`, {
      params: { lang: this.lang },
    });
  }

  /** Le pide la cadena evolutiva al BFF, en una petición aparte del detalle. */
  evolution(nameOrId: string | number): Observable<EvolutionNode> {
    return this.http.get<EvolutionNode>(
      `${API}/pokemon/${encodeURIComponent(nameOrId)}/evolution`,
      { params: { lang: this.lang } },
    );
  }
}

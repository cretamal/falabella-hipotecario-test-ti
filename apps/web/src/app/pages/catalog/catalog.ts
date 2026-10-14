import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import type { Page, PokemonSummary } from '@pokedex/contracts';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { CatalogMemory } from '../../core/catalog-memory';
import { NavigationHint } from '../../core/navigation-hint';
import { PokemonGateway } from '../../pokemon/application/pokemon-gateway';
import { Button } from '../../ui/atoms/button/button';
import { ROUTER_LINK } from '../../ui/atoms/link/link';
import { Pager } from '../../ui/molecules/pager/pager';
import { StateMessage } from '../../ui/molecules/state-message/state-message';
import { CatalogFilters } from '../../ui/organisms/catalog-filters/catalog-filters';
import { PokemonGrid } from '../../ui/organisms/pokemon-grid/pokemon-grid';
import { PageLayout } from '../../ui/templates/page-layout/page-layout';
import {
  type CatalogParams,
  hasActiveFilters,
  parseCatalogParams,
  sameCatalogParams,
  toApiQuery,
  toQueryParams,
} from './catalog-params';
import { Text } from '../../ui/atoms/text/text';

/** `stale`: se muestran los resultados anteriores (atenuados) mientras llegan los nuevos. */
type CatalogState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; page: Page<PokemonSummary>; stale: boolean };

const LOADING: CatalogState = { status: 'loading' };

/**
 * La página del catálogo (inteligente): lee el estado desde la URL, le pide la página al gateway y reparte los datos a
 * los organismos de UI. En esta pantalla es la única que conoce las rutas y los servicios.
 */
@Component({
  selector: 'app-catalog',
  imports: [
    Text,
    Button,
    CatalogFilters,
    Pager,
    PageLayout,
    PokemonGrid,
    ROUTER_LINK,
    StateMessage,
  ],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  protected readonly gateway = inject(PokemonGateway);
  protected readonly hint = inject(NavigationHint);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly memory = inject(CatalogMemory);

  private readonly retry$ = new BehaviorSubject<void>(undefined);
  private lastState: CatalogState = LOADING;

  /** La URL es la única fuente de verdad del estado del catálogo. */
  protected readonly params = toSignal(this.route.queryParamMap.pipe(map(parseCatalogParams)), {
    requireSync: true,
  });

  protected readonly filters = toSignal(this.gateway.filters().pipe(catchError(() => of(null))), {
    initialValue: null,
  });

  protected readonly state = toSignal(
    combineLatest([
      this.route.queryParamMap.pipe(
        map(parseCatalogParams),
        distinctUntilChanged(sameCatalogParams),
      ),
      this.retry$,
    ]).pipe(
      tap(([params]) => this.memory.params.set(toQueryParams(params))),
      switchMap(([params]) =>
        this.gateway.list(toApiQuery(params)).pipe(
          map((page): CatalogState => ({ status: 'ready', page, stale: false })),
          catchError(() => of<CatalogState>({ status: 'error' })),
          startWith(this.loadingFrom(this.lastState)),
        ),
      ),
      tap((state) => (this.lastState = state)),
    ),
    { initialValue: LOADING },
  );

  /**
   * Si ya hay resultados no volvemos al esqueleto: los dejamos (atenuados) hasta que lleguen los nuevos.
   */
  private loadingFrom(previous: CatalogState): CatalogState {
    return previous.status === 'ready' ? { ...previous, stale: true } : LOADING;
  }

  /** ¿Hay búsqueda o filtros puestos? Decide si aparece «Limpiar filtros». */
  protected readonly hasFilters = () => hasActiveFilters(this.params());
  /** Cuántas páginas hay en total (mínimo una, aunque no haya resultados). */
  protected readonly totalPages = (page: Page<PokemonSummary>) =>
    Math.max(1, Math.ceil(page.total / page.limit));

  /** Fija el título y la descripción de la página (para la pestaña y los buscadores). */
  constructor() {
    inject(Title).setTitle($localize`:@@catalog.title:Explorador de Pokémon`);
    inject(Meta).updateTag({
      name: 'description',
      content: $localize`:@@catalog.description:Explora el catálogo de Pokémon, búscalos por nombre y filtra por tipo o generación.`,
    });
  }

  /**
   * Cambia la búsqueda y vuelve a la página 1. Reemplaza la URL para no llenar el historial letra por letra.
   */
  protected onSearch(q: string): void {
    this.navigate({ ...this.params(), q, page: 1 }, true);
  }

  /** Cambia el filtro de tipo y vuelve a la página 1. */
  protected onType(type: string): void {
    this.navigate({ ...this.params(), type, page: 1 });
  }

  /** Cambia el filtro de generación y vuelve a la página 1. */
  protected onGeneration(generation: number | null): void {
    this.navigate({ ...this.params(), generation, page: 1 });
  }

  /** Borra la búsqueda y los filtros de una sola vez. */
  protected clearFilters(): void {
    this.navigate({ q: '', type: '', generation: null, page: 1 });
  }

  /** Reintenta la carga después de un error. */
  protected retry(): void {
    this.retry$.next();
  }

  /** Escribe el estado en la URL; la carga reacciona a ese cambio (acá manda la URL). */
  private navigate(params: CatalogParams, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(params),
      replaceUrl,
    });
  }
}

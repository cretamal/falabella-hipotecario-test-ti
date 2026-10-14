import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  RESPONSE_INIT,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import type { EvolutionNode, PokemonDetail, PokemonSummary } from '@pokedex/contracts';
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
import { evolutionTargets } from '../../shared/evolution-targets';
import { PokemonGateway } from '../../pokemon/application/pokemon-gateway';
import { Button } from '../../ui/atoms/button/button';
import { ROUTER_LINK } from '../../ui/atoms/link/link';
import { Text } from '../../ui/atoms/text/text';
import { StateMessage } from '../../ui/molecules/state-message/state-message';
import { EvolutionPanel } from '../../ui/organisms/evolution-panel/evolution-panel';
import { PokemonAbout } from '../../ui/organisms/pokemon-about/pokemon-about';
import { PokemonHero } from '../../ui/organisms/pokemon-hero/pokemon-hero';
import { StatsPanel } from '../../ui/organisms/stats-panel/stats-panel';
import { PageLayout } from '../../ui/templates/page-layout/page-layout';

/** Los estados de la carga del detalle: cargando, con error, no existe, o listo con los datos. */
type DetailState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notfound' }
  | { status: 'ready'; pokemon: PokemonDetail };

const LOADING: DetailState = { status: 'loading' };

/** La evolución carga y falla por separado: el contenido principal no se queda esperándola. */
type EvolutionState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; root: EvolutionNode };

const EVOLUTION_LOADING: EvolutionState = { status: 'loading' };

/**
 * La página del detalle (inteligente): carga el Pokémon desde la URL, la evolución por separado y reparte los datos a
 * los organismos de UI. También se preocupa del título, del 404 real en SSR y de precargar las etapas vecinas.
 */
@Component({
  selector: 'app-pokemon-detail',
  imports: [
    Button,
    Text,
    EvolutionPanel,
    PageLayout,
    PokemonAbout,
    PokemonHero,
    ROUTER_LINK,
    StateMessage,
    StatsPanel,
  ],
  templateUrl: './pokemon-detail.html',
  styleUrl: './pokemon-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonDetailPage {
  protected readonly gateway = inject(PokemonGateway);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  /**
   * Solo existe durante el SSR: nos permite responder un 404 de verdad (y no un 200 con "no encontrado").
   */
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  private readonly retry$ = new BehaviorSubject<void>(undefined);
  private readonly retryEvolution$ = new BehaviorSubject<void>(undefined);
  /**
   * La evolución se pide solo en el navegador: el SSR responde con el contenido principal y listo.
   */
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La cabecera inmediata al abrir desde el catálogo (solo mientras llega el detalle). */
  protected readonly summary = signal<PokemonSummary | null>(
    inject(NavigationHint).take(inject(ActivatedRoute).snapshot.paramMap.get('name')),
  );

  /** Los parámetros del catálogo para el enlace "Volver" (última búsqueda, página y filtros). */
  protected readonly catalogParams = inject(CatalogMemory).params;

  protected readonly state = toSignal(
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('name') ?? ''),
        distinctUntilChanged(),
      ),
      this.retry$,
    ]).pipe(
      tap(([name]) => {
        if (this.summary()?.name !== name) this.summary.set(null);
      }),
      switchMap(([name]) =>
        this.gateway.detail(name).pipe(
          tap((pokemon) => this.setMeta(pokemon)),
          map((pokemon): DetailState => ({ status: 'ready', pokemon })),
          catchError((error: unknown) => of(this.failure(error))),
          startWith(LOADING),
        ),
      ),
    ),
    { initialValue: LOADING },
  );

  protected readonly evolution = toSignal(
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('name') ?? ''),
        distinctUntilChanged(),
      ),
      this.retryEvolution$,
    ]).pipe(
      switchMap(([name]) =>
        this.browser
          ? this.gateway.evolution(name).pipe(
              tap((root) => this.warm(root, name)),
              map((root): EvolutionState => ({ status: 'ready', root })),
              catchError(() => of<EvolutionState>({ status: 'error' })),
              startWith(EVOLUTION_LOADING),
            )
          : of(EVOLUTION_LOADING),
      ),
    ),
    { initialValue: EVOLUTION_LOADING },
  );

  /**
   * Con la ficha ya pintada, calienta por detrás las etapas más cercanas para que abrirlas no tenga espera.
   */
  private warm(root: EvolutionNode, current: string): void {
    const ids = evolutionTargets(root, current);
    // Lanza las precargas en orden de cercanía; la cola del gateway las va dosificando.
    const run = () => ids.forEach((id) => this.gateway.prefetchDetail(id));
    if ('requestIdleCallback' in globalThis) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 200);
  }

  /** Reintenta cargar el detalle después de un error. */
  protected retry(): void {
    this.retry$.next();
  }

  /** Reintenta solo la evolución; el resto de la ficha ya está en pantalla y no se toca. */
  protected retryEvolution(): void {
    this.retryEvolution$.next();
  }

  /**
   * Traduce un error de carga a un estado: 404 = no existe (y en SSR responde 404 de verdad); cualquier otro = error que se
   * puede reintentar. De paso deja el título de la pestaña acorde.
   */
  private failure(error: unknown): DetailState {
    const notFound = error instanceof HttpErrorResponse && error.status === 404;
    if (notFound && this.responseInit) this.responseInit.status = 404;
    this.title.setTitle(
      notFound
        ? $localize`:@@detail.title.notFound:Pokémon no encontrado · Explorador de Pokémon`
        : $localize`:@@detail.title.error:Error · Explorador de Pokémon`,
    );
    return { status: notFound ? 'notfound' : 'error' };
  }

  /**
   * Con el detalle ya cargado, pone el título de la pestaña y la descripción para los buscadores.
   */
  private setMeta(pokemon: PokemonDetail): void {
    this.title.setTitle(
      `${pokemon.label} · ${$localize`:@@detail.title.suffix:Explorador de Pokémon`}`,
    );
    this.meta.updateTag({ name: 'description', content: pokemon.description || pokemon.genus });
  }
}

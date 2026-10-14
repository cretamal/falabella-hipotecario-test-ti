import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import type { PokemonSummary } from '@pokedex/contracts';
import { ROUTER_LINK } from '../../atoms/link/link';
import { PokemonImage } from '../../atoms/pokemon-image/pokemon-image';
import { TypeChip } from '../../atoms/type-chip/type-chip';
import { Text } from '../../atoms/text/text';
import { Skeleton } from '../../atoms/skeleton/skeleton';

/**
 * Cuánto tiene que estar el cursor (o el foco) sobre la tarjeta para que lo tomemos como intención de abrirla.
 */
export const INTENT_DELAY_MS = 150;

/** Molécula: la tarjeta de un Pokémon (imagen, número, nombre y tipos). Enlaza a su detalle. */
@Component({
  selector: 'app-pokemon-card',
  imports: [Skeleton, Text, ROUTER_LINK, PokemonImage, TypeChip],
  templateUrl: './pokemon-card.html',
  styleUrl: './pokemon-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonCard {
  /** Sin datos = cargando: mostramos un marcador con la misma forma que la tarjeta. */
  readonly pokemon = input<PokemonSummary>();
  /** Se abrió esta tarjeta (clic o Enter): la ficha puede pintar su cabecera al tiro. */
  readonly selected = output<PokemonSummary>();
  /**
   * Hay intención de abrirla (cursor o foco sostenidos, o un toque): así podemos precargar el detalle.
   */
  readonly intent = output<string>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Cuando la tarjeta se destruye descartamos la intención pendiente. */
  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelIntent());
  }

  /** Avisa que se abrió esta tarjeta (clic o Enter) para que la ficha pinte su cabecera al tiro. */
  protected select(): void {
    const pokemon = this.pokemon();
    if (pokemon) this.selected.emit(pokemon);
  }

  /**
   * `now`: el toque no espera (en una pantalla táctil no existe el «cursor encima», así que va al tiro).
   */
  protected startIntent(now = false): void {
    const pokemon = this.pokemon();
    if (!pokemon) return;
    this.cancelIntent();
    if (now) this.intent.emit(pokemon.name);
    else this.timer = setTimeout(() => this.intent.emit(pokemon.name), INTENT_DELAY_MS);
  }

  /** Descarta la intención pendiente (el cursor salió antes del retardo y no pasó nada). */
  protected cancelIntent(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  protected readonly number = computed(() => String(this.pokemon()?.id ?? 0).padStart(3, '0'));
}

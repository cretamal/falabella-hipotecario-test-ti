import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import type { PokemonSummary } from '@pokedex/contracts';
import { PokemonCard } from '../../molecules/pokemon-card/pokemon-card';

/**
 * Organismo: la grilla responsive de tarjetas; mientras carga muestra marcadores con la misma forma.
 */
@Component({
  selector: 'app-pokemon-grid',
  imports: [PokemonCard],
  templateUrl: './pokemon-grid.html',
  styleUrl: './pokemon-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonGrid {
  readonly items = input<readonly PokemonSummary[]>([]);
  readonly loading = input(false, { transform: booleanAttribute });
  /** Los resultados anteriores mientras llegan los nuevos: se atenúan, sin cambiar el layout. */
  readonly stale = input(false, { transform: booleanAttribute });
  /** Se abrió una tarjeta (clic o Enter). */
  readonly selected = output<PokemonSummary>();
  /**
   * Hay intención de abrir una tarjeta (cursor o foco sostenidos, o un toque): se puede precargar su detalle.
   */
  readonly intent = output<string>();
  readonly skeletonCount = input(12);
  protected readonly placeholders = computed(() => Array.from({ length: this.skeletonCount() }));
}

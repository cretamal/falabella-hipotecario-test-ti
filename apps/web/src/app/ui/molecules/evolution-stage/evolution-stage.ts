import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import type { EvolutionNode } from '@pokedex/contracts';
import { ROUTER_LINK } from '../../atoms/link/link';
import { PokemonImage } from '../../atoms/pokemon-image/pokemon-image';

/**
 * Cuánto tiene que estar el cursor (o el foco) sobre la etapa para que lo tomemos como intención de abrirla.
 */
export const STAGE_INTENT_DELAY_MS = 150;

/** Molécula: una etapa de la cadena evolutiva (imagen y nombre). Enlaza al detalle por id. */
@Component({
  selector: 'app-evolution-stage',
  imports: [ROUTER_LINK, PokemonImage],
  templateUrl: './evolution-stage.html',
  styleUrl: './evolution-stage.scss',
  host: { '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolutionStage {
  readonly stage = input.required<Pick<EvolutionNode, 'id' | 'label' | 'imageUrl'>>();
  /** ¿Es el Pokémon que se está viendo ahora? */
  readonly current = input(false);
  /**
   * La versión reducida (miniatura de 48 px), pensada para espacios estrechos como la cabecera de la ficha.
   */
  readonly compact = input(false, { transform: booleanAttribute });
  /**
   * Hay intención de abrirla (cursor o foco sostenidos, o un toque): emitimos su id para ir precargando el detalle.
   */
  readonly intent = output<string>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Cuando el componente se destruye descartamos la intención pendiente, para que no emita cuando ya no está.
   */
  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelIntent());
  }

  /**
   * `now`: el toque no espera (en una pantalla táctil no existe el «cursor encima», así que va al tiro).
   */
  protected startIntent(now = false): void {
    this.cancelIntent();
    const id = String(this.stage().id);
    if (now) this.intent.emit(id);
    else this.timer = setTimeout(() => this.intent.emit(id), STAGE_INTENT_DELAY_MS);
  }

  /** Descarta la intención pendiente (el cursor salió antes del retardo y no pasó nada). */
  protected cancelIntent(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

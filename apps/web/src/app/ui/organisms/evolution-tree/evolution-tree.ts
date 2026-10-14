import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import type { EvolutionNode } from '@pokedex/contracts';
import { isWide } from '../../../shared/evolution-layout';
import { EvolutionConditions } from '../../molecules/evolution-conditions/evolution-conditions';
import { EvolutionStage } from '../../molecules/evolution-stage/evolution-stage';

/**
 * Organismo: la cadena evolutiva. Se llama a sí mismo por cada rama; cada etapa navega a su detalle.
 */
@Component({
  selector: 'app-evolution-tree',
  imports: [EvolutionConditions, EvolutionStage],
  templateUrl: './evolution-tree.html',
  styleUrl: './evolution-tree.scss',
  host: { '[class.compact]': 'compact()', '[class.wide]': 'wide()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolutionTree {
  readonly node = input.required<EvolutionNode>();
  /** El nombre del Pokémon que se está viendo (para resaltar su etapa, también en sus formas). */
  readonly currentName = input.required<string>();
  /** La versión reducida: etapas pequeñas y ramas en filas que se ajustan al ancho disponible. */
  readonly compact = input(false, { transform: booleanAttribute });

  /**
   * El id de una etapa sobre la que hay intención de abrirla (también las de las ramas anidadas).
   */
  readonly intent = output<string>();

  /** Muchas ramas (Eevee): una rejilla bajo la etapa de origen, con las condiciones plegables. */
  protected readonly wide = computed(() => isWide(this.node()));

  protected readonly isCurrent = computed(() => {
    const { name } = this.node();
    const current = this.currentName();
    return current === name || current.startsWith(`${name}-`);
  });
}

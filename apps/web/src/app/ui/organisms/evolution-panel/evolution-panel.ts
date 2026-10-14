import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import type { EvolutionNode } from '@pokedex/contracts';
import { Button } from '../../atoms/button/button';
import { Skeleton } from '../../atoms/skeleton/skeleton';
import { Text } from '../../atoms/text/text';
import { EvolutionTree } from '../evolution-tree/evolution-tree';

/**
 * Organismo: la evolución del Pokémon en versión compacta y sin tarjeta, pensada para la ranura lateral de la
 * cabecera de la ficha. Si el Pokémon no evoluciona no ocupa espacio (el host se oculta).
 */
@Component({
  selector: 'app-evolution-panel',
  imports: [Button, Skeleton, Text, EvolutionTree],
  templateUrl: './evolution-panel.html',
  styleUrl: './evolution-panel.scss',
  host: { '[class.none]': '!visible()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolutionPanel {
  readonly root = input<EvolutionNode>();
  readonly currentName = input<string>('');
  /** La carga falló: ofrecemos reintentar (sin `root` ni `failed` = cargando). */
  readonly failed = input(false, { transform: booleanAttribute });
  readonly retry = output<void>();
  /** Hay intención de abrir una etapa (id): la página puede aprovechar y precargar su detalle. */
  readonly intent = output<string>();

  /** Con la cadena cargada y sin evoluciones no hay nada que mostrar. */
  protected readonly visible = computed(() => {
    const root = this.root();
    return !root || root.evolvesTo.length > 0;
  });
}

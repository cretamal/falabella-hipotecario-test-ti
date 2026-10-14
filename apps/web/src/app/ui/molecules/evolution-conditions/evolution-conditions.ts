import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Molécula: las condiciones para evolucionar a una etapa. Cuando son varias (por ejemplo, una lista de lugares) mostramos
 * la primera y dejamos el resto tras «+N más», así no se comen la altura de la rejilla.
 */
@Component({
  selector: 'app-evolution-conditions',
  templateUrl: './evolution-conditions.html',
  styleUrl: './evolution-conditions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolutionConditions {
  /** El nombre de la etapa de destino (lo usamos para el texto accesible). */
  readonly label = input.required<string>();
  readonly items = input.required<string[]>();

  protected readonly open = signal(false);
  protected readonly shown = computed(() =>
    this.open() ? this.items() : this.items().slice(0, 1),
  );
  protected readonly hidden = computed(() => this.items().length - 1);
}

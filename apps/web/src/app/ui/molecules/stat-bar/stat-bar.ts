import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { NamedLabel } from '@pokedex/contracts';
import { Meter } from '../../atoms/meter/meter';
import { Text } from '../../atoms/text/text';
import { statTone, toneLabel } from './stat-tier';

/**
 * Molécula: una estadística base (etiqueta, valor y una barra con el color de su tramo, en escala 0–255).
 */
@Component({
  selector: 'app-stat-bar',
  imports: [Meter, Text],
  template: `
    <app-text class="label" tone="muted">{{ stat().label }}</app-text>
    <app-text class="value" weight="semibold" align="end" numeric>{{ stat().value }}</app-text>
    <app-meter
      guides
      [value]="stat().value"
      [max]="max"
      [label]="stat().label"
      [tone]="tone()"
      [valueText]="valueText()"
    />
  `,
  styleUrl: './stat-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatBar {
  readonly stat = input.required<NamedLabel & { value: number }>();
  protected readonly max = 255;
  protected readonly tone = computed(() => statTone(this.stat().value));
  protected readonly valueText = computed(() => `${this.stat().value}, ${toneLabel(this.tone())}`);
}

import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/** El tramo de color de la barra (bajo, medio, alto, excepcional). */
export type MeterTone = 'low' | 'mid' | 'high' | 'top';

/**
 * Átomo: barra de medición (`role="meter"`) con etiqueta accesible. El color por tramo (`tone`), las guías cada 50
 * unidades (`guides`) y la entrada animada (solo CSS) son opcionales, ponles lo que necesites.
 */
@Component({
  selector: 'app-meter',
  template: `
    <div
      class="track"
      role="meter"
      [class]="tone() ? 'track ' + tone() : 'track'"
      [class.guides]="guides()"
      aria-valuemin="0"
      [attr.aria-valuemax]="max()"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuetext]="valueText()"
      [attr.aria-label]="label()"
    >
      <div class="fill" [style.width.%]="percent()"></div>
    </div>
  `,
  styleUrl: './meter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Meter {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly label = input.required<string>();
  readonly tone = input<MeterTone>();
  /** El texto para lectores de pantalla (por ejemplo «60, medio»); por defecto, el número. */
  readonly valueText = input<string>();
  /** Marcas sutiles cada 50 unidades. */
  readonly guides = input(false, { transform: booleanAttribute });

  protected readonly percent = computed(() =>
    Math.min(100, Math.max(0, (this.value() / this.max()) * 100)),
  );
}

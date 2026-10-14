import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Las formas del marcador de carga. */
export type SkeletonShape = 'block' | 'text' | 'circle' | 'image' | 'chip';

/**
 * Átomo: un marcador de carga con brillo animado. Es decorativo (los lectores de pantalla lo ignoran): el anuncio
 * «Cargando…» lo hace la página con `role="status"`. Las formas y medidas salen de tokens y atributos.
 */
@Component({
  selector: 'app-skeleton',
  template: `
    @if (shape() === 'text') {
      @for (_ of rows(); track $index) {
        <span class="bar"></span>
      }
    }
  `,
  styleUrl: './skeleton.scss',
  host: {
    'aria-hidden': 'true',
    '[attr.data-shape]': 'shape()',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly shape = input<SkeletonShape>('block');
  /** El ancho y el alto en CSS; si se omiten, los decide la forma. */
  readonly width = input<string>();
  readonly height = input<string>();
  /** Solo para `text`: la cantidad de líneas (la última es más corta). */
  readonly lines = input(1);
  protected readonly rows = computed(() => Array.from({ length: Math.max(1, this.lines()) }));
}

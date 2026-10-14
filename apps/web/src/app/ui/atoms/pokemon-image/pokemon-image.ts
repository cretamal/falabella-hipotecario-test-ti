import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';

/**
 * Átomo: una imagen con el tamaño reservado (sin saltos de layout) y un marcador si falla la carga. `alt=""` (por
 * defecto) la deja como decorativa. Con `placeholder` (una miniatura que ya tenemos) se ve detrás mientras llega la imagen
 * principal.
 */
@Component({
  selector: 'app-pokemon-image',
  templateUrl: './pokemon-image.html',
  styleUrl: './pokemon-image.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonImage {
  readonly src = input.required<string>();
  readonly alt = input('');
  /** El lado en px (la imagen es cuadrada). */
  readonly size = input.required<number>();
  /** Para sprites de pocos píxeles. */
  readonly pixelated = input(false, { transform: booleanAttribute });
  /**
   * Carga inmediata y prioritaria (imágenes visibles al abrir la página); por defecto es `lazy`.
   */
  readonly eager = input(false, { transform: booleanAttribute });
  /**
   * La miniatura que se ve mientras llega `src` (ya está en caché, por ejemplo la del catálogo).
   */
  readonly placeholder = input<string>();

  private readonly img = viewChild<ElementRef<HTMLImageElement>>('img');

  /** Se reinician cada vez que cambia la imagen. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly loaded = linkedSignal({ source: this.src, computation: () => false });

  /**
   * Después del primer render revisa si la imagen ya venía cargada desde el SSR, para no dejarla en «cargando» para
   * siempre.
   */
  constructor() {
    // Con SSR la imagen puede terminar de cargar antes de la hidratación: el evento `load` ya pasó, ojo.
    afterNextRender(() => {
      const el = this.img()?.nativeElement;
      if (el?.complete && el.naturalWidth > 0) this.loaded.set(true);
    });
  }
}

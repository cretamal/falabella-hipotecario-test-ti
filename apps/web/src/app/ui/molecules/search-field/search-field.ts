import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Text } from '../../atoms/text/text';

/**
 * Molécula: el campo de búsqueda (etiqueta e `<input type="search">`). `value` es el valor "oficial" (por ejemplo el de
 * la URL): se refleja en el campo, salvo que el usuario esté escribiendo.
 */
@Component({
  selector: 'app-search-field',
  imports: [Text],
  templateUrl: './search-field.html',
  styleUrl: './search-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchField {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly maxLength = input(50);
  readonly value = input('');
  /**
   * Una pista asociada al campo (por ejemplo el largo mínimo); solo se muestra con `hintVisible`.
   */
  readonly hint = input('');
  readonly hintVisible = input(false);
  /** El texto actual tras cada pulsación (sin debounce: eso lo decide quien use el campo). */
  readonly textChange = output<string>();
  /** Enter: quien lo use puede buscar al tiro, sin esperar el debounce. */
  readonly submitted = output<string>();

  protected readonly hintId = computed(() => `${this.inputId()}-hint`);

  private readonly document = inject(DOCUMENT);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /**
   * Mantiene el campo sincronizado con el valor de afuera (por ejemplo «Limpiar filtros»), pero sin pisar lo que el
   * usuario esté escribiendo en ese momento.
   */
  constructor() {
    effect(() => {
      const el = this.field().nativeElement;
      const value = this.value();
      if (el.value.trim() !== value && this.document.activeElement !== el) el.value = value;
    });
  }

  /** Escape vacía el campo (y avisa), en todos los navegadores. */
  protected onEscape(): void {
    const el = this.field().nativeElement;
    if (!el.value) return;
    el.value = '';
    this.textChange.emit('');
  }

  /** Avisa el texto actual en cada pulsación; el debounce lo decide quien use el campo. */
  protected onInput(event: Event): void {
    this.textChange.emit((event.target as HTMLInputElement).value);
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Text } from '../../atoms/text/text';

/** Una opción de la lista: el valor interno y el texto que se ve. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Molécula: una lista desplegable con etiqueta y una opción "vacía" (`value=""`) para quitar el filtro.
 */
@Component({
  selector: 'app-select-field',
  imports: [Text],
  templateUrl: './select-field.html',
  styleUrl: './select-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectField {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly emptyLabel = input.required<string>();
  readonly options = input.required<SelectOption[]>();
  /** El valor seleccionado; `''` = opción vacía. */
  readonly value = input('');
  readonly selected = output<string>();

  /** Avisa el valor elegido (`''` = quitar el filtro). */
  protected onChange(event: Event): void {
    this.selected.emit((event.target as HTMLSelectElement).value);
  }
}

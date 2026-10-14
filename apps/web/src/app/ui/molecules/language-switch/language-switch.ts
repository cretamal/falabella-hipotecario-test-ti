import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HardLink } from '../../atoms/link/link';

/** Un idioma del selector: identificador y nombre en su propio idioma. */
export interface LanguageOption {
  id: string;
  label: string;
}

/**
 * Molécula: el selector de idioma. `hrefFor` decide el destino (la misma página en otro idioma); es una recarga completa,
 * porque cada idioma es una app distinta.
 */
@Component({
  selector: 'app-language-switch',
  imports: [HardLink],
  templateUrl: './language-switch.html',
  styleUrl: './language-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitch {
  readonly options = input.required<readonly LanguageOption[]>();
  readonly active = input.required<string>();
  readonly hrefFor = input.required<(id: string) => string>();
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { NamedLabel } from '@pokedex/contracts';

/** Átomo: un chip con el tipo del Pokémon; el color sale de los tokens `--type-*`. */
@Component({
  selector: 'app-type-chip',
  template: `<span class="chip" [attr.data-type]="type().name">{{ type().label }}</span>`,
  styleUrl: './type-chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeChip {
  readonly type = input.required<NamedLabel>();
}

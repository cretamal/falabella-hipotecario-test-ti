import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Molécula: una franja de aviso a todo el ancho (`role="status"`). El mensaje y las acciones se las pasamos de afuera,
 * así el banner no sabe de qué se está avisando.
 */
@Component({
  selector: 'app-banner',
  template: `<p class="banner" role="status" [class.warning]="tone() === 'warning'">
    <ng-content />
  </p>`,
  styleUrl: './banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Banner {
  readonly tone = input<'info' | 'warning'>('info');
}

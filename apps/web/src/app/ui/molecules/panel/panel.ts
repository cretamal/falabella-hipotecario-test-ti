import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Text } from '../../atoms/text/text';

/** Molécula: una sección con borde y encabezado (`<h2>`). El contenido se lo pasamos proyectado. */
@Component({
  selector: 'app-panel',
  imports: [Text],
  template: `
    <section class="panel" [attr.aria-labelledby]="headingId()">
      <app-text as="h2" class="heading" variant="heading" [id]="headingId()">{{
        heading()
      }}</app-text>
      <ng-content />
    </section>
  `,
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Panel {
  readonly heading = input.required<string>();
  readonly headingId = input.required<string>();
}

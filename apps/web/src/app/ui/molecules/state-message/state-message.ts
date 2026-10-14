import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Text } from '../../atoms/text/text';

/**
 * Molécula: un mensaje de estado (vacío, error, no encontrado). Las acciones se las pasamos proyectadas con `<ng-content>`.
 */
@Component({
  selector: 'app-state-message',
  imports: [Text],
  template: `
    <section class="state" [attr.role]="kind() === 'error' ? 'alert' : null">
      <app-text as="h2" variant="heading">{{ heading() }}</app-text>
      @if (description()) {
        <app-text as="p" class="description" tone="muted">{{ description() }}</app-text>
      }
      <div class="actions"><ng-content /></div>
    </section>
  `,
  styleUrl: './state-message.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateMessage {
  readonly kind = input<'info' | 'error'>('info');
  readonly heading = input.required<string>();
  readonly description = input<string>();
}

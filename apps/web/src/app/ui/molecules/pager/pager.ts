import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Button } from '../../atoms/button/button';
import { ROUTER_LINK } from '../../atoms/link/link';
import { Text } from '../../atoms/text/text';

/**
 * Molécula: la paginación, con enlaces de verdad (`?page=N`). Por eso funciona sin JS, con SSR y abriéndola en una pestaña nueva.
 */
@Component({
  selector: 'app-pager',
  imports: [Button, ROUTER_LINK, Text],
  templateUrl: './pager.html',
  styleUrl: './pager.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  protected readonly hasPrevious = computed(() => this.page() > 1);
  protected readonly hasNext = computed(() => this.page() < this.totalPages());
}

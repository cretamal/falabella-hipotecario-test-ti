import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Átomo: una etiqueta de texto cortito con borde (por ejemplo «Legendario»). */
@Component({
  selector: 'app-badge',
  template: '<ng-content />',
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {}

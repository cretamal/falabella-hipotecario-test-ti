import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Plantilla: la columna de contenido de una página. Ranuras: `[pageToolbar]` (arriba) y el contenido (por defecto).
 */
@Component({
  selector: 'app-page-layout',
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLayout {}

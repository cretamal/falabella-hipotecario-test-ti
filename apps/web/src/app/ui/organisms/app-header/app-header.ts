import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ROUTER_LINK } from '../../atoms/link/link';

/**
 * Organismo: la cabecera con la marca (enlace al inicio). Lo que le proyectemos queda a la derecha (por ejemplo, el
 * selector de idioma).
 */
@Component({
  selector: 'app-header',
  imports: [ROUTER_LINK],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {}

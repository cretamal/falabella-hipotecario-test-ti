import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Button } from '../../ui/atoms/button/button';
import { ROUTER_LINK } from '../../ui/atoms/link/link';
import { StateMessage } from '../../ui/molecules/state-message/state-message';
import { PageLayout } from '../../ui/templates/page-layout/page-layout';

/** La página 404 (rutas que no existen): muestra un mensaje y un botón para volver al catálogo. */
@Component({
  selector: 'app-not-found',
  imports: [Button, PageLayout, ROUTER_LINK, StateMessage],
  template: `
    <app-page-layout>
      <app-state-message
        heading="Página no encontrada"
        i18n-heading="@@notFound.title"
        description="La dirección que buscas no existe."
        i18n-description="@@notFound.description"
      >
        <div appButton="primary" routerLink="/" i18n="@@detail.notFound.action">Ir al catálogo</div>
      </app-state-message>
    </app-page-layout>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {
  /** Fija el título de la pestaña para la página 404. */
  constructor() {
    inject(Title).setTitle(
      $localize`:@@notFound.documentTitle:Página no encontrada · Explorador de Pokémon`,
    );
  }
}

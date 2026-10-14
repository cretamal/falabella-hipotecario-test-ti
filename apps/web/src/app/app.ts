import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter, map } from 'rxjs';
import { Connectivity } from './core/connectivity';
import { Banner } from './ui/molecules/banner/banner';
import {
  type LanguageOption,
  LanguageSwitch,
} from './ui/molecules/language-switch/language-switch';
import { AppFooter } from './ui/organisms/app-footer/app-footer';
import { AppHeader } from './ui/organisms/app-header/app-header';
import { AppShell } from './ui/templates/app-shell/app-shell';

/** Los idiomas que ofrece el selector del encabezado. */
const LOCALES: readonly LanguageOption[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

/**
 * La raíz: arma la plantilla `AppShell` con cabecera, avisos, contenido enrutado y pie de página.
 */
@Component({
  selector: 'app-root',
  imports: [AppFooter, AppHeader, AppShell, Banner, LanguageSwitch, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly updates = inject(SwUpdate);
  protected readonly online = inject(Connectivity).online;
  protected readonly activeLocale = inject(LOCALE_ID).startsWith('en') ? 'en' : 'es';

  protected readonly updateReady = signal(false);

  /**
   * La ruta actual sin el prefijo de idioma: sirve para cambiar de idioma y quedarse en la misma página.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly locales = LOCALES;
  /**
   * `ng serve` sirve un solo idioma (en la raíz); el cambio de idioma solo existe en el build de producción.
   */
  protected readonly showLanguages = !isDevMode();
  /**
   * El enlace a la misma página en otro idioma (cada idioma es una app distinta, así que es una recarga completa).
   */
  protected readonly localeHref = (id: string) => `/${id}${this.url()}`;

  /**
   * Si el service worker está activo, queda atento a que haya una versión nueva lista para avisarle al usuario.
   */
  constructor() {
    if (this.updates.isEnabled) {
      this.updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this.updateReady.set(true);
      });
    }
  }

  /** Recarga la página para que el usuario tome la versión nueva que avisó el service worker. */
  protected reload(): void {
    this.document.location.reload();
  }
}

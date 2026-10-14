import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Plantilla: el esqueleto de toda la app. Solo ranuras, sin datos:
 * `[shellHeader]`, `[shellBanners]`, contenido principal (por defecto) y `[shellFooter]`.
 */
@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  /**
   * Enfoca el contenido principal (un `href="#main"` apuntaría al <base href>, por eso lo hacemos así).
   */
  protected skipToMain(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}

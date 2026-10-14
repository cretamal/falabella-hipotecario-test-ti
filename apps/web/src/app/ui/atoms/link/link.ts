import { DOCUMENT } from '@angular/common';
import { Directive, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Átomo: deja accesible un `<div routerLink>` como enlace. `RouterLink` ya navega con el clic y le pone
 * `tabindex="0"` a los elementos no nativos; acá le sumamos el rol `link` y la activación con Enter (que un `<div>`
 * no trae de serie).
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector -- complementa a RouterLink de Angular (selector ajeno al prefijo)
  selector: '[routerLink]:not(a):not(area)',
  host: { role: 'link', '(keydown.enter)': 'activate()' },
})
export class RouterLinkRole {
  private readonly link = inject(RouterLink, { self: true });

  /** Enter sobre el `<div>`: dispara la misma navegación que el clic. */
  protected activate(): void {
    this.link.onClick(0, false, false, false, false);
  }
}

/**
 * Átomo: un enlace que sale del router de Angular (otro idioma = otra aplicación; sitio externo). Se usa sobre
 * `<div>` o `<span>`: `<div [appHardLink]="url">`. Clic o Enter navegan; Ctrl/⌘+clic o `target="blank"` abren una pestaña nueva.
 */
@Directive({
  selector: '[appHardLink]',
  host: { role: 'link', tabindex: '0', '(click)': 'go($event)', '(keydown.enter)': 'go($event)' },
})
export class HardLink {
  readonly appHardLink = input.required<string>();
  readonly target = input<'self' | 'blank'>('self');

  private readonly window = inject(DOCUMENT).defaultView;

  /** Navega al destino: en la misma pestaña, o en una nueva con Ctrl/⌘+clic o `target="blank"`. */
  protected go(event: Event): void {
    event.preventDefault();
    const newTab =
      this.target() === 'blank' ||
      (event instanceof MouseEvent && (event.ctrlKey || event.metaKey));
    if (newTab) this.window?.open(this.appHardLink(), '_blank', 'noopener,noreferrer');
    else this.window?.location.assign(this.appHardLink());
  }
}

/** Los enlaces internos: se importa `ROUTER_LINK` en vez de `RouterLink` suelto. */
export const ROUTER_LINK = [RouterLink, RouterLinkRole];

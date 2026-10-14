import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** El estado de la conexión del navegador; en el servidor siempre figura "en línea". */
@Injectable({ providedIn: 'root' })
export class Connectivity {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly _online = signal(this.window?.navigator.onLine ?? true);
  readonly online = this._online.asReadonly();

  /** Se suscribe a los eventos `online` y `offline` del navegador para mantener la señal al día. */
  constructor() {
    this.window?.addEventListener('online', () => this._online.set(true));
    this.window?.addEventListener('offline', () => this._online.set(false));
  }
}

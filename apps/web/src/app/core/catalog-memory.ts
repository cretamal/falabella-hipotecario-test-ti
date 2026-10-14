import { Injectable, signal } from '@angular/core';
import type { Params } from '@angular/router';

/**
 * Se acuerda de la última búsqueda, filtros y página del catálogo, para que «Volver» desde el detalle la restaure tal cual.
 */
@Injectable({ providedIn: 'root' })
export class CatalogMemory {
  readonly params = signal<Params>({});
}

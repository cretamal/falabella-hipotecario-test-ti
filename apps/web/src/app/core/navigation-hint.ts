import { Injectable } from '@angular/core';
import type { PokemonSummary } from '@pokedex/contracts';

/**
 * Resumen del Pokémon que se acaba de abrir desde el catálogo: la ficha lo usa para pintar su cabecera al tiro
 * mientras llega el detalle. Se consume una sola vez y solo si coincide con el destino.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHint {
  private summary: PokemonSummary | null = null;

  /**
   * Deja anotado el resumen del Pokémon que se está abriendo (lo llama el catálogo al hacer clic).
   */
  set(summary: PokemonSummary): void {
    this.summary = summary;
  }

  /** Entrega el resumen una sola vez y solo si corresponde al Pokémon de destino; si no, `null`. */
  take(name: string | null): PokemonSummary | null {
    const summary = this.summary;
    this.summary = null;
    return summary && summary.name === name ? summary : null;
  }
}

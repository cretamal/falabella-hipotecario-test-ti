import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { CatalogFilters as CatalogFiltersData } from '@pokedex/contracts';
import { EMPTY, Subject, filter, map, of, switchMap, timer } from 'rxjs';
import { isSearchable, isTooShort, normalizeQuery } from '../../../shared/search-query';
import { Button } from '../../atoms/button/button';
import { SearchField } from '../../molecules/search-field/search-field';
import { SelectField, type SelectOption } from '../../molecules/select-field/select-field';

/** Los valores actuales de la búsqueda y los filtros. */
export interface CatalogFilterValues {
  q: string;
  type: string;
  generation: number | null;
}

/**
 * Cuánto esperamos después de la última tecla antes de buscar, para no disparar una consulta por cada letra.
 */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Organismo: la barra de búsqueda y filtros del catálogo. Es presentacional: recibe los valores actuales y emite los
 * cambios (la búsqueda ya con debounce); quien lo use decide qué hacer con ellos.
 */
@Component({
  selector: 'app-catalog-filters',
  imports: [Button, SearchField, SelectField],
  templateUrl: './catalog-filters.html',
  styleUrl: './catalog-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFilters {
  readonly values = input.required<CatalogFilterValues>();
  /**
   * Las opciones de tipo y generación; `null` mientras no estén disponibles (se ocultan los selectores).
   */
  readonly options = input.required<CatalogFiltersData | null>();
  readonly canClear = input(false);

  readonly searchChange = output<string>();
  readonly typeChange = output<string>();
  readonly generationChange = output<number | null>();
  readonly cleared = output<void>();

  private readonly typing = new Subject<{ text: string; now: boolean }>();
  /** Hay un único carácter: avisamos del mínimo en vez de buscar. */
  protected readonly tooShort = signal(false);

  protected readonly typeOptions = computed<SelectOption[]>(() =>
    (this.options()?.types ?? []).map((t) => ({ value: t.name, label: t.label })),
  );
  protected readonly generationOptions = computed<SelectOption[]>(() =>
    (this.options()?.generations ?? []).map((g) => ({ value: String(g.id), label: g.label })),
  );
  protected readonly generationValue = computed(() => String(this.values().generation ?? ''));

  /**
   * Arma el flujo de búsqueda: espera el debounce, no busca con un solo carácter, deja pasar al tiro el campo vacío y el
   * Enter, y solo emite si el texto realmente cambió.
   */
  constructor() {
    this.typing
      .pipe(
        // switchMap cancela la espera pendiente con cada entrada nueva (borrar hasta dejar 1 carácter no deja escapar la
        // búsqueda anterior). Vaciar el campo y el Enter no esperan el debounce.
        switchMap(({ text, now }) => {
          if (text === '') return of(text);
          if (!isSearchable(text)) return EMPTY;
          return now ? of(text) : timer(SEARCH_DEBOUNCE_MS).pipe(map(() => text));
        }),
        // Comparamos con el valor vigente (no con lo último que se emitió): si se limpia desde afuera y el usuario vuelve a
        // escribir lo mismo, igual tiene que emitirse.
        filter((text) => text !== this.values().q),
        takeUntilDestroyed(),
      )
      .subscribe((text) => this.searchChange.emit(text));
  }

  /**
   * Recibe lo que escribió el usuario: lo normaliza, avisa si es muy corto y lo mete al flujo de búsqueda.
   */
  protected onText(raw: string, now = false): void {
    const text = normalizeQuery(raw);
    this.tooShort.set(isTooShort(text));
    this.typing.next({ text, now });
  }

  /** Convierte la generación elegida a número (`''` = sin filtro) y la emite. */
  protected onGeneration(value: string): void {
    this.generationChange.emit(Number(value) || null);
  }
}

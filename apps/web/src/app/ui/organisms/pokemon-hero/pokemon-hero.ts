import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PokemonDetail, PokemonSummary } from '@pokedex/contracts';
import { Badge } from '../../atoms/badge/badge';
import { PokemonImage } from '../../atoms/pokemon-image/pokemon-image';
import { TypeChip } from '../../atoms/type-chip/type-chip';
import { Text } from '../../atoms/text/text';
import { Skeleton } from '../../atoms/skeleton/skeleton';

/**
 * Organismo: la cabecera de la ficha (artwork, número, nombre, categoría, tipos, generación y marcas). Admite un estado
 * parcial (`summary`) y uno de carga. La ranura `[heroAside]` aloja contenido lateral (la evolución).
 */
@Component({
  selector: 'app-pokemon-hero',
  imports: [NgTemplateOutlet, Skeleton, Text, Badge, PokemonImage, TypeChip],
  templateUrl: './pokemon-hero.html',
  styleUrl: './pokemon-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonHero {
  /** Sin `pokemon` ni `summary` = cargando (marcadores). */
  readonly pokemon = input<PokemonDetail>();
  /** Lo que ya sabemos desde el catálogo: cabecera inmediata mientras llega el detalle. */
  readonly summary = input<PokemonSummary | null>();
  protected readonly number = computed(() =>
    String(this.pokemon()?.id ?? this.summary()?.id ?? 0).padStart(3, '0'),
  );
}

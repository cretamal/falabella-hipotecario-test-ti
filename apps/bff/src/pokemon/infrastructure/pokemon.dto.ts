import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  CatalogFilters,
  CatalogQuery,
  EvolutionNode,
  Lang,
  NamedLabel,
  Page,
  PokemonDetail,
  PokemonSummary,
} from '@pokedex/contracts';
import { MAX_LIMIT } from '../application/pokemon.service.js';

import { SEARCH_MAX_LENGTH, cleanQuery } from '../../common/text.js';

/** Si el parámetro viene vacío (`?type=`) lo tratamos como si no hubiera venido. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;
/**
 * "" → ausente; cualquier otro valor → número (la validación que viene después se encarga de rechazar el NaN).
 */
const toNumber = ({ value }: { value: unknown }) =>
  value === '' || value === undefined ? undefined : Number(value);

// Entrada

/** Parámetro de consulta común a todos los endpoints: el idioma de los textos. */
export class LangQueryDto {
  /** Idioma de los textos. Si se omite, se usa `Accept-Language` y, por defecto, `es`. */
  @IsOptional()
  @Transform(blankToUndefined)
  @IsIn(['es', 'en'])
  lang?: Lang;
}

/**
 * Los parámetros del catálogo (`GET /pokemon`): búsqueda, filtros y paginación. Todo se valida y se convierte a su
 * tipo antes de llegar al controlador, así allá ya llega limpio.
 */
export class ListPokemonQueryDto extends LangQueryDto {
  /** Texto a buscar en el nombre (parcial, sin distinguir mayúsculas ni tildes). */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? cleanQuery(value) || undefined : value,
  )
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  q?: string;

  /** La clave del tipo ("fire"). */
  @IsOptional()
  @Transform(blankToUndefined)
  @Matches(/^[a-z-]{1,20}$/)
  type?: string;

  /** La generación, de 1 a 9. */
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(9)
  generation?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;
}

/** El tamaño de página cuando el cliente no pide uno. */
export const DEFAULT_LIMIT = 24;

/**
 * Pasa el DTO ya validado al formato interno `CatalogQuery`, con los valores por defecto puestos.
 */
export const toCatalogQuery = (dto: ListPokemonQueryDto): CatalogQuery => ({
  q: dto.q,
  type: dto.type,
  generation: dto.generation,
  offset: dto.offset ?? 0,
  limit: dto.limit ?? DEFAULT_LIMIT,
});

/**
 * El parámetro de ruta del detalle: clave o número del Pokémon (solo caracteres seguros, nada raro).
 */
export class PokemonParamDto {
  /** La clave ("pikachu") o el número ("25"). */
  @Matches(/^[a-zA-Z0-9-]{1,64}$/)
  name!: string;
}

// Salida (clases para OpenAPI; el compilador las mantiene alineadas con @pokedex/contracts)

/** Un par clave + etiqueta traducida (tipos, habilidades, estadísticas). */
export class NamedLabelDto implements NamedLabel {
  name!: string;
  label!: string;
}

/** El resumen de un Pokémon, lo justo para las tarjetas del catálogo. */
export class PokemonSummaryDto implements PokemonSummary {
  id!: number;
  name!: string;
  label!: string;
  imageUrl!: string;
  types!: NamedLabelDto[];
}

/** Una página de resultados del catálogo. */
export class PokemonPageDto implements Page<PokemonSummary> {
  /** Solo viene si no hubo coincidencias exactas y estamos mostrando nombres parecidos. */
  fuzzy?: true;
  items!: PokemonSummaryDto[];
  total!: number;
  offset!: number;
  limit!: number;
}

/** Una generación con su etiqueta traducida. */
export class GenerationLabelDto {
  id!: number;
  label!: string;
}

/** Las opciones que tienen los filtros del catálogo. */
export class CatalogFiltersDto implements CatalogFilters {
  types!: NamedLabelDto[];
  generations!: GenerationLabelDto[];
}

/** Una habilidad de un Pokémon; `hidden` dice si es la oculta. */
export class AbilityDto extends NamedLabelDto {
  hidden!: boolean;
}

/** Una estadística base con su valor. */
export class StatDto extends NamedLabelDto {
  value!: number;
}

/** Un nodo del árbol evolutivo (recursivo: cada nodo trae a sus hijos). */
export class EvolutionNodeDto implements EvolutionNode {
  id!: number;
  name!: string;
  label!: string;
  imageUrl!: string;
  conditions!: string[];
  evolvesTo!: EvolutionNodeDto[];
}

/** La ficha completa de un Pokémon, sin la cadena evolutiva (esa se pide aparte). */
export class PokemonDetailDto implements PokemonDetail {
  id!: number;
  name!: string;
  label!: string;
  genus!: string;
  description!: string;
  imageUrl!: string;
  thumbUrl!: string;
  types!: NamedLabelDto[];
  heightM!: number;
  weightKg!: number;
  abilities!: AbilityDto[];
  stats!: StatDto[];
  generation!: GenerationLabelDto;
  legendary!: boolean;
  mythical!: boolean;
}

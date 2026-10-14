import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Cached } from '../../common/memoizer.js';
import { resolveLang } from '../../common/lang.js';
import { PokemonService } from '../application/pokemon.service.js';
import {
  CatalogFiltersDto,
  EvolutionNodeDto,
  LangQueryDto,
  ListPokemonQueryDto,
  PokemonDetailDto,
  PokemonPageDto,
  PokemonParamDto,
  toCatalogQuery,
} from './pokemon.dto.js';

/** Catálogo y filtros: 5 min de caché compartida (navegador, service worker y proxies). */
const CACHE_CONTROL = 'public, max-age=300';
/**
 * Detalle y evolución casi no cambian: 1 h de caché y hasta 1 día vencido mientras se revalida por detrás.
 */
const DETAIL_CACHE_CONTROL =
  'public, max-age=3600, stale-while-revalidate=86400';

/**
 * Acá solo hay HTTP de entrada y salida: valida, delega en el servicio y traduce el resultado. Nada de lógica de negocio.
 */
@ApiTags('pokemon')
@Controller()
export class PokemonController {
  constructor(private readonly pokemon: PokemonService) {}

  /**
   * Catálogo paginado con búsqueda y filtros. Valida la entrada, delega en el servicio y deja puestas las cabeceras de
   * caché.
   */
  @Get('pokemon')
  @ApiOperation({
    summary:
      'Catálogo paginado con búsqueda parcial y filtros por tipo y generación',
  })
  @ApiOkResponse({ type: PokemonPageDto })
  @ApiBadGatewayResponse({ description: 'PokéAPI no disponible' })
  async list(
    @Query() query: ListPokemonQueryDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return reply(
      res,
      await this.pokemon.list(
        toCatalogQuery(query),
        resolveLang(query.lang, acceptLanguage),
      ),
    );
  }

  /** Tipos y generaciones disponibles para los filtros, en el idioma pedido. */
  @Get('filters')
  @ApiOperation({
    summary: 'Tipos (con Pokémon) y generaciones disponibles para filtrar',
  })
  @ApiOkResponse({ type: CatalogFiltersDto })
  @ApiBadGatewayResponse({ description: 'PokéAPI no disponible' })
  async filters(
    @Query() query: LangQueryDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return reply(
      res,
      await this.pokemon.filters(resolveLang(query.lang, acceptLanguage)),
    );
  }

  /** Detalle de un Pokémon por nombre o número. Si no existe, responde un 404 de verdad. */
  @Get('pokemon/:name')
  @ApiOperation({
    summary: 'Detalle de un Pokémon por clave o número, con cadena evolutiva',
  })
  @ApiOkResponse({ type: PokemonDetailDto })
  @ApiNotFoundResponse({ description: 'Pokémon no encontrado' })
  @ApiBadGatewayResponse({ description: 'PokéAPI no disponible' })
  async detail(
    @Param() { name }: PokemonParamDto,
    @Query() query: LangQueryDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.pokemon.detail(
      name,
      resolveLang(query.lang, acceptLanguage),
    );
    if (!result.data) throw new NotFoundException('Pokémon no encontrado');
    return reply(
      res,
      result as Cached<NonNullable<typeof result.data>>,
      DETAIL_CACHE_CONTROL,
    );
  }

  /**
   * La cadena evolutiva del Pokémon, separada del detalle para que la ficha no se quede esperándola.
   */
  @Get('pokemon/:name/evolution')
  @ApiOperation({
    summary: 'Cadena evolutiva de un Pokémon (con condiciones localizadas)',
  })
  @ApiOkResponse({ type: EvolutionNodeDto })
  @ApiNotFoundResponse({ description: 'Pokémon no encontrado' })
  @ApiBadGatewayResponse({ description: 'PokéAPI no disponible' })
  async evolution(
    @Param() { name }: PokemonParamDto,
    @Query() query: LangQueryDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.pokemon.evolution(
      name,
      resolveLang(query.lang, acceptLanguage),
    );
    if (!result.data) throw new NotFoundException('Pokémon no encontrado');
    return reply(
      res,
      result as Cached<NonNullable<typeof result.data>>,
      DETAIL_CACHE_CONTROL,
    );
  }
}

/**
 * Deja puestas las cabeceras comunes de la respuesta (`X-Cache`, `Cache-Control` y `Vary`) y devuelve el dato tal cual.
 */
function reply<T>(
  res: Response,
  { data, hit }: Cached<T>,
  cacheControl = CACHE_CONTROL,
): T {
  res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
  res.setHeader('Cache-Control', cacheControl);
  res.vary('Accept-Language');
  return data;
}

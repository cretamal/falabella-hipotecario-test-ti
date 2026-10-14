import { Module } from '@nestjs/common';
import { Memoizer } from '../common/memoizer.js';
import { PokemonSource } from './application/pokemon-source.port.js';
import { PokemonService } from './application/pokemon.service.js';
import { HealthController } from './infrastructure/health.controller.js';
import { PokeApiClient } from './infrastructure/pokeapi.client.js';
import { PokeApiSource } from './infrastructure/pokeapi.source.js';
import { PokemonController } from './infrastructure/pokemon.controller.js';

/**
 * Módulo del dominio Pokémon: conecta el controlador, el servicio de aplicación y el adaptador de PokéAPI. Acá, y solo
 * acá, se decide qué fuente de datos se usa.
 */
@Module({
  controllers: [PokemonController, HealthController],
  providers: [
    Memoizer,
    PokeApiClient,
    PokemonService,
    // Único punto donde se elige la fuente de datos: cambiar de proveedor es cambiar esta línea y nada más.
    { provide: PokemonSource, useClass: PokeApiSource },
  ],
})
export class PokemonModule {}

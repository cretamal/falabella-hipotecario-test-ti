import { CacheModule } from '@nestjs/cache-manager';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createKeyv } from '@keyv/redis';
import { memoryStore } from './config/cache-store.js';
import { type AppConfig, configuration } from './config/configuration.js';
import { PokemonModule } from './pokemon/pokemon.module.js';

/**
 * Módulo raíz del BFF. Acá se arma lo que atraviesa todo el servicio: la configuración tipada, la caché de dos niveles
 * (memoria y, si viene `REDIS_URL`, también Redis) y el límite de peticiones por IP. Lo propio del dominio vive en
 * `PokemonModule`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const logger = new Logger('Cache');
        const stores = [memoryStore()];
        const redisUrl = config.get('redisUrl', { infer: true });
        if (redisUrl) {
          const redis = createKeyv(redisUrl);
          redis.on('error', (error: unknown) =>
            logger.warn(`Redis: ${String(error)}`),
          );
          stores.push(redis);
          logger.log('Caché: memoria + Redis');
        } else {
          logger.log('Caché: memoria');
        }
        return { stores };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttlMs, limit } = config.get('throttle', { infer: true });
        return [{ ttl: ttlMs, limit }];
      },
    }),
    PokemonModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

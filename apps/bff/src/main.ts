import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/configuration.js';

/**
 * Levanta el BFF: crea la app Nest, le pone el prefijo `/api` y la validación global de entrada (bota lo que no
 * declaramos y convierte los tipos), publica Swagger en `/api/docs` y se queda escuchando. Los apagados ordenados
 * quedan activos para que Docker lo pueda detener sin cortar peticiones a medio camino.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.set('trust proxy', config.get('trustProxy', { infer: true }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Explorador de Pokémon · BFF')
      .setDescription(
        'Backend for Frontend sobre PokéAPI: catálogo, búsqueda, filtros y detalle.',
      )
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('port', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(
    `BFF en http://localhost:${port}/api (docs: /api/docs)`,
  );
}
await bootstrap();

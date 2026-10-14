import { CacheModule } from '@nestjs/cache-manager';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { Memoizer } from '../src/common/memoizer.js';
import { configuration } from '../src/config/configuration.js';
import { PokemonSource } from '../src/pokemon/application/pokemon-source.port.js';
import { PokemonService } from '../src/pokemon/application/pokemon.service.js';
import { HealthController } from '../src/pokemon/infrastructure/health.controller.js';
import { PokemonController } from '../src/pokemon/infrastructure/pokemon.controller.js';
import { FakePokemonSource } from './fakes.js';

describe('API del BFF (e2e, fuente falsa)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        CacheModule.register(),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
      ],
      controllers: [PokemonController, HealthController],
      providers: [
        Memoizer,
        PokemonService,
        { provide: PokemonSource, useClass: FakePokemonSource },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/pokemon pagina y filtra', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pokemon?type=fire&limit=2&lang=en')
      .expect(200);
    expect(res.body).toMatchObject({ total: 3, offset: 0, limit: 2 });
    expect(res.body.items).toHaveLength(2);
    expect(res.headers['x-cache']).toMatch(/HIT|MISS/);
    expect(res.headers['cache-control']).toContain('max-age=300');
  });

  it('valida los parámetros (400)', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/pokemon?limit=999').expect(400);
    await http.get('/api/pokemon?offset=-1').expect(400);
    await http.get('/api/pokemon?generation=abc').expect(400);
    await http.get('/api/pokemon?lang=fr').expect(400);
    await http.get('/api/pokemon/a%20b').expect(400);
  });

  it('trata los parámetros vacíos como ausentes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pokemon?q=&type=&generation=')
      .expect(200);
    expect(res.body.total).toBe(7);
  });

  it('busca por relevancia, por número y con erratas', async () => {
    const http = request(app.getHttpServer());
    const typo = await http.get('/api/pokemon?q=pikchu').expect(200);
    expect(typo.body.fuzzy).toBe(true);
    expect(typo.body.items[0].name).toBe('pikachu');
    const exact = await http.get('/api/pokemon?q=pika').expect(200);
    expect(exact.body.fuzzy).toBeUndefined();
    expect((await http.get('/api/pokemon?q=%23025')).body.items[0].name).toBe(
      'pikachu',
    );
    expect((await http.get('/api/pokemon?q=!!!')).body.total).toBe(0);
    expect((await http.get('/api/pokemon?q=%20%09%20')).body.total).toBe(7);
  });

  it('rechaza una consulta demasiado larga y admite la de longitud máxima', async () => {
    const http = request(app.getHttpServer());
    await http.get(`/api/pokemon?q=${'a'.repeat(51)}`).expect(400);
    await http.get(`/api/pokemon?q=${'a'.repeat(50)}`).expect(200);
  });

  it('revalida con ETag (304) y varía por idioma', async () => {
    const http = request(app.getHttpServer());
    const first = await http.get('/api/pokemon?q=char&lang=es').expect(200);
    expect(first.headers.etag).toBeTruthy();
    expect(first.headers.vary).toContain('Accept-Language');
    await http
      .get('/api/pokemon?q=char&lang=es')
      .set('If-None-Match', first.headers.etag)
      .expect(304);
  });

  it('GET /api/pokemon/:name devuelve el detalle o 404', async () => {
    const http = request(app.getHttpServer());
    const ok = await http
      .get('/api/pokemon/pikachu')
      .set('Accept-Language', 'en-US')
      .expect(200);
    expect(ok.body.genus).toBe('en');
    const missing = await http.get('/api/pokemon/no-existe').expect(404);
    expect(missing.body).toMatchObject({
      statusCode: 404,
      message: 'Pokémon no encontrado',
    });
  });

  it('el detalle no incluye la evolución y trae la miniatura; se cachea una hora', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pokemon/pikachu')
      .expect(200);
    expect(res.body).toHaveProperty('thumbUrl');
    expect(res.body).not.toHaveProperty('evolution');
    expect(res.headers['cache-control']).toContain('max-age=3600');
    expect(res.headers['cache-control']).toContain(
      'stale-while-revalidate=86400',
    );
  });

  it('GET /api/pokemon/:name/evolution devuelve la cadena o 404', async () => {
    const http = request(app.getHttpServer());
    const ok = await http.get('/api/pokemon/pikachu/evolution').expect(200);
    expect(ok.body).toMatchObject({ name: 'pikachu', evolvesTo: [] });
    expect(ok.headers['cache-control']).toContain('max-age=3600');
    await http.get('/api/pokemon/no-existe/evolution').expect(404);
    await http.get('/api/pokemon/a%20b/evolution').expect(400);
  });

  it('GET /api/filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/filters?lang=es')
      .expect(200);
    expect(res.body.types[0]).toEqual({ name: 'fire', label: 'Fuego' });
  });

  it('limita las peticiones (429) pero no el health check', async () => {
    const http = request(app.getHttpServer());
    for (let i = 0; i < 50; i++) await http.get('/api/health').expect(200);
    const statuses = [];
    for (let i = 0; i < 30; i++)
      statuses.push((await http.get('/api/filters')).status);
    expect(statuses).toContain(429);
  });
});

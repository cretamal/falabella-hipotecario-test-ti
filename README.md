# Explorador de Pokémon

Aplicación web para explorar Pokémon: **Angular 21** (frontend) + **NestJS 12** (Backend for Frontend) sobre [PokéAPI](https://pokeapi.co). El navegador nunca habla con PokéAPI: todo pasa por el BFF.

- Catálogo paginado, **búsqueda por nombre** parcial, ordenada por relevancia, por número y tolerante a erratas, filtros por **tipo** y **generación**.
- Detalle con descripción, estadísticas, habilidades y **cadena evolutiva**.
- Interfaz y datos en **español e inglés**, renderizado en servidor (SSR) y **PWA** (funciona sin conexión con lo ya visitado).

> Diseño completo y trazabilidad con el enunciado: [`docs/SDD.md`](docs/SDD.md).
> Evolución del proyecto (documentos incrementales): [`docs/mejoras/`](docs/mejoras/README.md).

## Instalación y despliegue local

### 1. Requisitos y versiones

| Herramienta | Versión | Para qué | Cómo verificarla |
|---|---|---|---|
| Git | cualquiera reciente | Descargar el repositorio | `git --version` |
| Node.js | **24** (fijada en `.nvmrc`; `engines`: `>=24`) | Todo el proyecto | `node -v` |
| npm | **≥ 10** (viene con Node 24) | Dependencias y scripts (workspaces) | `npm -v` |
| Docker + Docker Compose v2 | Docker 24+ | Solo para el despliegue con contenedores | `docker --version` · `docker compose version` |
| Navegador | Chrome/Chromium reciente | Abrir la app; Playwright descarga el suyo | — |
| Python 3 | 3.9+ | Solo si cambias textos i18n (`npm run i18n`) | `python3 --version` |

Versiones principales del proyecto: Angular 21, NestJS 12, TypeScript 6.0.3, Redis 8 (solo en Docker). Sin base de datos, claves ni secretos: la única dependencia externa es la PokéAPI pública (se necesita internet).

Puertos que usa: **4200** (web en desarrollo), **4000** (web SSR en producción/Docker) y **3000** (BFF; en Docker no se publica al host).

Para instalar la versión correcta de Node con [nvm](https://github.com/nvm-sh/nvm): `nvm install && nvm use` (lee `.nvmrc`).

### 2. Descargar el proyecto

```bash
git clone git@github.com:cretamal/falabella-hipotecario-test-ti.git
cd falabella-hipotecario-test-ti
```

(Si recibiste el código como `.zip`, descomprímelo y entra a la carpeta.)

### 3. Instalar dependencias

Un solo comando en la raíz instala los tres workspaces (`apps/web`, `apps/bff`, `packages/contracts`):

```bash
nvm use            # opcional, si usas nvm
npm install        # o `npm ci` para respetar exactamente package-lock.json
```

No hace falta crear archivos `.env`: todo tiene valores por defecto (ver [Configuración](#configuración)). Si quieres cambiar algo, copia `apps/bff/.env.example` a `apps/bff/.env`.

### 4. Elegir cómo levantarlo

#### A) Desarrollo con recarga en caliente (npm)

```bash
npm run dev          # BFF en http://localhost:3000 + web en http://localhost:4200  (español)
npm run dev:en       # igual, con la web en inglés
```

`ng serve` sirve un solo idioma, por eso el selector de idioma está oculto. Abre <http://localhost:4200>. Para detener, `Ctrl+C`.

#### B) Producción local, sin Docker (SSR, los dos idiomas, PWA)

```bash
npm run build        # compila BFF y web (genera /es y /en)
npm start            # web SSR en http://localhost:4000  ·  BFF en :3000
```

Abre <http://localhost:4000>. Si cambias el código, vuelve a ejecutar `npm run build`.

#### C) Con Docker (web SSR + BFF + Redis)

```bash
docker compose up --build        # primera vez (construye las imágenes)
docker compose up -d             # siguientes veces, en segundo plano
docker compose ps                # estado: redis, bff y web deben quedar "healthy"/"running"
docker compose logs -f web       # ver logs
docker compose down              # detener y quitar los contenedores
```

Abre <http://localhost:4000>. El BFF no se publica en el host: se alcanza a través del servidor web (`http://localhost:4000/api/…`, con la documentación OpenAPI en **`/api/docs`**). La caché usa memoria + Redis.

### 5. Comprobar que quedó funcionando

```bash
curl http://localhost:4000/api/health                      # {"status":"ok"}  (en dev: http://localhost:3000/api/health)
curl "http://localhost:4000/api/pokemon?q=pika&limit=5"    # catálogo filtrado
```

Y en el navegador: el catálogo carga, la búsqueda `pika` encuentra a Pikachu y el detalle muestra la cadena evolutiva.

### 6. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Unsupported engine` / errores de sintaxis al instalar | Node distinto de 24: `nvm use`. |
| `EADDRINUSE` (puerto ocupado) | Cierra lo que use 3000/4000/4200 o cambia `PORT` (BFF). Con Docker: `docker compose down`. |
| El catálogo tarda o da 502 la primera vez | El BFF construye el índice desde PokéAPI (~30 llamadas); necesita internet. Reintenta unos segundos después. |
| `npm run e2e` usa una versión vieja | El E2E reutiliza un servidor ya levantado en :4000: detén Docker/`npm start` antes y vuelve a ejecutar `npm run build && npm run e2e`. |
| Playwright pide navegadores | `cd apps/web && npx playwright install chromium --with-deps`. |

## Configuración

No hay nada obligatorio: todas las variables son opcionales y tienen un valor por defecto (sin claves ni secretos; PokéAPI es pública). Referencia en [`apps/bff/.env.example`](apps/bff/.env.example).

| Variable | App | Por defecto | Descripción |
|---|---|---|---|
| `PORT` | bff / web | `3000` / `4000` | Puertos |
| `POKEAPI_BASE_URL` | bff | `https://pokeapi.co/api/v2` | Origen de datos |
| `POKEAPI_TIMEOUT_MS` | bff | `5000` | Timeout por llamada saliente |
| `REDIS_URL` | bff | — | Si se define, la caché usa memoria + Redis |
| `CACHE_INDEX_TTL_MS` / `CACHE_DETAIL_TTL_MS` / `CACHE_LABEL_TTL_MS` | bff | 24 h / 24 h / 24 h | TTL de caché |
| `CACHE_DETAIL_STALE_MS` | bff | 7 d | Pasado el TTL, el detalle se sirve obsoleto mientras se refresca (y si PokéAPI cae) |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` | bff | `240` / `60000` | Límite de peticiones por IP |
| `TRUST_PROXY` | bff | `false` | `1` detrás del servidor web (Compose lo activa) |
| `BFF_URL` | web | `http://localhost:3000` | BFF usado por el SSR y el reenvío de `/api` |

## Cómo revisar

1. `npm run build && npm start` y abrir <http://localhost:4000>.
2. Escribir `pika` (sin Enter), elegir **Tipo = Fuego** y **Generación = I**, abrir un Pokémon (Pikachu, Eevee para ver ramas de evolución) y volver: la búsqueda y la página se conservan (viven en la URL).
3. Cambiar de idioma; abrir `/es/pokemon/no-existe` (404 real); apagar la red tras navegar un poco (modo sin conexión).
4. En DevTools → Network: ninguna petición a `pokeapi.co`; la cabecera `X-Cache` de `/api/pokemon` muestra la caché en acción.
5. Documentación de la API: <http://localhost:4000/api/docs>.
6. Código, de afuera hacia adentro:
   - BFF: `pokemon.controller.ts` → `pokemon.service.ts` → `pokemon-source.port.ts` ← `pokeapi.source.ts`
   - Web: `catalog.ts` / `pokemon-detail.ts` → `pokemon-gateway.ts` ← `http-pokemon-gateway.ts`

## Pruebas

```bash
npm test             # BFF (unitarias + e2e de controlador) y web: 267 tests
npm run bench -w apps/bff   # rendimiento de la búsqueda (1.350 entradas, caché de producción)
npm run lint         # oxlint (BFF) + ESLint con reglas de accesibilidad (web)

# E2E con Playwright (50 casos, incluye axe WCAG 2.1 AA, SSR, idiomas y modo sin conexión)
npx playwright install chromium --with-deps   # una vez (en apps/web)
npm run build && npm run e2e
```

Los E2E usan la PokéAPI real (si el servicio público cae, fallan). CI en GitHub Actions: lint + tests, build + E2E y construcción de las imágenes Docker.

## Arquitectura

```
Navegador ──▶ web SSR (Angular 21) ──/api──▶ BFF (NestJS 12) ──▶ PokéAPI
                    │                          └─ caché: memoria (+ Redis opcional)
                    └── ambos importan los tipos de packages/contracts
```

```
apps/web/              Angular 21: SSR, i18n (es/en), PWA
apps/bff/              NestJS 12: API para las pantallas, caché, límite de peticiones, OpenAPI
packages/contracts/    DTOs compartidos (solo tipos)
docs/SDD.md            Diseño y requisitos
```

**Capa desacoplada en ambos lados (puertos y adaptadores):** la lógica depende de una clase abstracta que hace de contrato y de token de inyección; el adaptador concreto se elige en una sola línea.

| | Puerto (aplicación) | Adaptador (infraestructura) | Se elige en |
|---|---|---|---|
| BFF | `PokemonSource` | `PokeApiSource` (+ `PokeApiClient`) | `pokemon.module.ts` |
| Web | `PokemonGateway` | `HttpPokemonGateway` | `app.config.ts` |

Las formas de PokéAPI solo existen en `pokeapi.source.ts`; las páginas nunca inyectan `HttpClient`. Los tests de lógica usan *fakes* de los puertos, sin red.

### API del BFF

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/pokemon?q=&type=&generation=&offset=&limit=&lang=` | Catálogo paginado con búsqueda y filtros |
| GET | `/api/pokemon/:name` | Detalle por nombre o número, sin evolución (404 si no existe) |
| GET | `/api/pokemon/:name/evolution` | Cadena evolutiva con condiciones localizadas |
| GET | `/api/filters` | Tipos (con Pokémon) y generaciones |
| GET | `/api/health` · `/api/docs` | Liveness · OpenAPI |

## Decisiones principales

- **El BFF aporta valor, no solo reenvía:** PokéAPI no tiene búsqueda parcial ni filtros combinados. El BFF construye un índice enriquecido (≈ 30 llamadas en lugar de 1.350), lo cachea y filtra en memoria; además agrega las ≈ 8 fuentes del detalle en una sola respuesta, localiza textos y convierte unidades.
- **El estado del catálogo vive en la URL** (`?q=&type=&gen=&page=`): recargar, compartir y "volver" funcionan sin store global.
- **Solo APIs estables de Angular 21:** se evitan `httpResource`, `resource` y Signal Forms (experimentales en v21).
- **SSR con 404 reales**, i18n por subruta (`/es`, `/en`) y PWA con datos en caché.
- **Robustez del BFF:** timeout y un reintento por llamada, 502 controlado, caché tolerante a fallos de Redis, carga compartida entre peticiones concurrentes, validación de parámetros y límite de peticiones por visitante (no falsificable).
- **Sin base de datos:** la app solo lee de PokéAPI; no hay datos propios que persistir, y la caché resuelve el rendimiento.
- **Componentes reutilizables con Atomic Design** y estilos aislados de la lógica (tokens + componentes presentacionales) para poder rediseñar la interfaz sin tocar TypeScript: ver abajo.

## Limitaciones

- El índice se refresca cada 24 h; sin Redis, la caché vive en el proceso.
- El catálogo incluye las formas alternativas de PokéAPI (`pikachu-gmax`…), al final del orden por id.
- Nombres del catálogo y de la cadena evolutiva derivados de la clave (`mr-mime` → "Mr Mime"); el nombre oficial localizado solo aparece en el detalle.
- Los E2E dependen de la disponibilidad de PokéAPI.

## Estilos y UX (para el rediseño)

Todo lo visual está separado de la lógica:

- `apps/web/src/styles/_tokens.scss`: **única fuente** de colores (claro/oscuro), tipografía, espaciado, radios y colores por tipo.
- `apps/web/src/styles/_reset.scss`, `_base.scss`: base global.
- `apps/web/src/app/ui/*`: componentes solo presentacionales organizados con **Atomic Design** (`atoms` → `molecules` → `organisms` → `templates`); las páginas (`app/pages/*`) son las únicas que acceden a datos. ESLint hace cumplir las capas.
- `*.scss` de páginas y plantillas: layout.

## Librerías y herramientas

| Área | Usado | Para qué |
|---|---|---|
| Frontend | Angular 21 (standalone, signals, zoneless), `@angular/ssr`, `@angular/localize`, `@angular/service-worker`, RxJS, SCSS propio | App, SSR, i18n, PWA (sin librería de UI) |
| BFF | NestJS 12, `@nestjs/config`, `@nestjs/cache-manager` (+ `cache-manager`, `keyv`, `cacheable`, `@keyv/redis`), `@nestjs/throttler`, `@nestjs/swagger`, `class-validator`, `class-transformer` | Configuración, caché, límite de peticiones, OpenAPI, validación. HTTP saliente con `fetch` nativo |
| Calidad | Vitest, `@nestjs/testing`, `supertest`, Playwright, `@axe-core/playwright`, oxlint, ESLint + `angular-eslint`, Prettier | Tests, E2E, accesibilidad, lint |
| Infra | npm workspaces, `concurrently`, Docker (multi-stage) + Compose, Redis 8, GitHub Actions | Monorepo, ejecución, CI |
| Datos | [PokéAPI](https://pokeapi.co) y sprites de `PokeAPI/sprites` | Fuente de datos e imágenes |

Proyecto de demostración, sin afiliación con Nintendo ni The Pokémon Company.

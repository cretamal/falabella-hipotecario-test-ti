# SDD — Explorador de Pokémon

> Software Design Document · Angular 21 + NestJS (BFF) · versión 3.2 (as-built) · 2026-10-13
> Fuente del requerimiento: `Prueba_Tecnica.pdf`. Este documento es la especificación que guía la implementación; cualquier cambio de alcance se registra aquí primero.
> **Estado:** implementado y verificado (165 tests web, 85 tests BFF, 50 E2E). Las secciones 3–9 describen lo construido.
> **Detalle (carga y rendimiento):** implementado según [`SDD-DETALLE.md`](SDD-DETALLE.md): núcleo y evolución en endpoints separados, resolución desde el índice, caché SWR, navegación optimista, precarga, compresión y transfer cache real.
> **Buscador (relevancia, rendimiento, robustez):** implementado según [`SDD-BUSQUEDA.md`](SDD-BUSQUEDA.md); las secciones RF-2, §6 y §7.3 lo resumen.
> **Alcance:** completo. No hay funcionalidades excluidas. El tiempo de referencia del documento (8 h) es solo indicativo y no condiciona el alcance.
> **Entrega:** repositorio **público en GitHub**, tal como pide el PDF. Ejecución con Docker; sin despliegue en un hosting público.

---

## 1. Análisis del requerimiento

### 1.1 Trazabilidad del PDF (cada frase con obligación → ID)

| ID | Texto original del documento | Cómo se cumple | Sección |
|---|---|---|---|
| PDF-1 | "La información está disponible públicamente en PokéAPI" | Única fuente de datos: `https://pokeapi.co/api/v2`. | §6 |
| PDF-2 | "el producto debe contar con una capa de backend propia que actúe como intermediaria entre la aplicación y el servicio externo (Backend for Frontend o BFF)" | BFF NestJS diseñado para las pantallas; el navegador nunca consulta datos a PokéAPI. | §3, §6 |
| PDF-3 | "aplicación web con Angular 21 para el frontend" | `@angular/*@21.x` fijado. | §2, §7 |
| PDF-4 | "NestJS para implementar el BFF" | NestJS 12. | §2, §6 |
| PDF-5 | "Explorar un catálogo de Pokémon de forma cómoda" | RF-1, RF-4, RF-5. | §7.3 |
| PDF-6 | "Encontrar un Pokémon por su nombre" | RF-2. | §6.3, §7.3 |
| PDF-7 | "Consultar información relevante de un Pokémon seleccionado" | RF-3, RF-6, RF-7. | §7.4 |
| PDF-8 | "La experiencia debe funcionar de principio a fin: desde la interfaz hasta la consulta de los datos externos a través del BFF" | Flujo UI → BFF → PokéAPI verificado por tests E2E. | §1.4, §9 |
| PDF-9 | "Tienes libertad para definir la arquitectura interna, la organización del código, las librerías complementarias y la experiencia de usuario" | Decisiones documentadas en §10 y en el README. | §10 |
| PDF-10 | "Nos interesa conocer tus decisiones técnicas" | Sección "Decisiones" en el README, con su porqué. | §10.1 |
| PDF-11 | "No buscamos una réplica visual de una Pokédex" | Diseño propio y sobrio (tarjetas y paneles neutros), sin imitar la carcasa ni la estética de la Pokédex. | §7.6 |
| PDF-12 | "Priorizamos una solución pequeña, funcional, clara y mantenible" | Criterio de calidad del código: una abstracción por frontera, sin capas vacías, módulos por feature, tests de la lógica. | §4, §9 |
| PDF-13 | "Si decides dejar algo fuera del alcance, explícalo brevemente" | No se excluye nada. Las limitaciones técnicas que existan se explican en §10.2. | §10.2 |
| PDF-14 | "Comparte el enlace a un repositorio de GitHub que incluya el código de Angular y NestJS" | Monorepo en GitHub con `apps/web` y `apps/bff`. | §3.3 |
| PDF-15 | README: "Instalar dependencias y ejecutar la solución localmente" | `npm install` + `npm run dev`; alternativa `docker compose up`. | §8 |
| PDF-16 | README: "Conocer cualquier requisito de configuración" | Tabla de requisitos y variables de entorno. | §8 |
| PDF-17 | README: "Entender, brevemente, las principales decisiones y limitaciones del desarrollo" | Resumen de §10. | §10 |
| PDF-18 | "El repositorio de GitHub debe ser público y estar disponible para revisión mediante el enlace compartido" | Repositorio GitHub con visibilidad `Public` (código y Actions visibles); se verifica abriendo el enlace sin sesión. | §11 |
| PDF-19 | "Indica en el README cuáles [librerías y herramientas de apoyo] utilizaste" | Tabla de librerías y herramientas. | §9.3 |
| PDF-20 | "cualquier consideración que sea útil para revisar tu trabajo" | Sección "Cómo revisar": recorrido sugerido, comandos de test y Swagger. | §8.4 |

### 1.2 Requisitos funcionales

| ID | Requisito | Criterio verificable |
|---|---|---|
| RF-1 | Catálogo paginado | Grilla con imagen, número, nombre y tipos; anterior/siguiente y "Página X de Y"; el estado vive en la URL (recargar y volver mantienen la página). |
| RF-2 | Búsqueda por nombre | Coincidencia **parcial** e insensible a mayúsculas y espacios (`char` → charmander, charmeleon, charizard…), con debounce. Resultados **ordenados por relevancia**, búsqueda por **número** (`25`, `#025`), varias palabras (`mime mr`) y **tolerancia a erratas** (`pikchu`, avisada como aproximada). Busca por el nombre de PokéAPI (el nombre localizado queda en BE-001). |
| RF-3 | Detalle del Pokémon | Imagen oficial, número, nombre, categoría (género), descripción, tipos, altura (m), peso (kg), habilidades (con marca de oculta), estadísticas base, generación y si es legendario o mítico. URL directa `/pokemon/:name`. |
| RF-4 | Filtro por tipo | Selector con los tipos que tienen Pokémon; combinable con búsqueda y generación. |
| RF-5 | Filtro por generación | Selector Generación I…IX; combinable con búsqueda y tipo. |
| RF-6 | Cadena evolutiva | En el detalle, árbol de evolución (incluye ramas, p. ej. Eevee) con imagen, nombre y condición (nivel, objeto, intercambio, amistad…); cada nodo navega a su detalle. |
| RF-7 | Contenido en español | Nombres de tipos, habilidades, estadísticas, generación, categoría y descripción en el idioma activo (es/en) con fallback a inglés. |
| RF-8 | Interfaz bilingüe | UI en español (idioma fuente) e inglés; selector de idioma; `/es/…` y `/en/…`. |
| RF-9 | Offline / instalable (PWA) | Instalable; las páginas y datos ya visitados funcionan sin conexión; aviso "Sin conexión". |
| RF-10 | Estados de interfaz | Cargando (skeleton), vacío, no encontrado (404) y error recuperable con "Reintentar". |

### 1.3 Requisitos no funcionales

| ID | Requisito | Cómo se cumple |
|---|---|---|
| RNF-1 | Desacoplamiento en web y BFF | Puertos (clase abstracta) + adaptadores en ambos lados (§4). |
| RNF-2 | Rendimiento | Caché en BFF (memoria, Redis opcional); SSR + transfer cache de `HttpClient`; imágenes `loading="lazy"`; rutas lazy. |
| RNF-3 | Resiliencia ante PokéAPI | Timeout por llamada; 502 controlado; la caché sigue sirviendo lo ya obtenido. |
| RNF-4 | Protección del BFF | Rate limiting por IP (`@nestjs/throttler`); validación estricta de parámetros. |
| RNF-5 | API documentada | OpenAPI/Swagger en `/api/docs`. |
| RNF-6 | SEO y primera carga | SSR (`RenderMode.Server`), `<title>` y `meta description` por página. |
| RNF-7 | Accesibilidad | WCAG 2.1 AA: etiquetas, foco visible, contraste, `aria-live`, navegación por teclado. |
| RNF-8 | Responsive | Mobile-first, sin scroll horizontal desde 320 px. |
| RNF-9 | Portabilidad | Dockerfiles + `docker-compose.yml` (web SSR, BFF, Redis). |
| RNF-10 | Calidad | TypeScript `strict`, ESLint, tests unitarios y E2E en CI (GitHub Actions). |

### 1.4 Criterios de aceptación (end-to-end)

1. `npm install && npm run dev` en un clon limpio levanta web (`:4200`) y BFF (`:3000`) sin pasos manuales extra.
2. `docker compose up --build` levanta web SSR (`:4000`), BFF (`:3000`) y Redis.
3. `http://localhost:4200` muestra la primera página del catálogo (24 Pokémon) con imagen, número y tipos.
4. Escribir `pika` muestra `pikachu` y sus formas sin presionar Enter; borrar el texto vuelve al catálogo.
5. Tipo = Fuego + Generación = I muestra charmander, charmeleon, charizard, vulpix, ninetales, growlithe, arcanine, ponyta, rapidash, magmar, flareon, moltres (y sus formas).
6. Clic en Pikachu abre `/es/pokemon/pikachu` con descripción en español, categoría "Pokémon Ratón", tipo "Eléctrico", habilidades y stats en español, y la cadena Pichu → Pikachu → Raichu.
7. "Volver" retorna al catálogo con la misma página, búsqueda y filtros.
8. `/es/pokemon/no-existe` muestra "Pokémon no encontrado" (BFF 404).
9. Con PokéAPI caída: la UI muestra error con "Reintentar" (BFF 502); los datos ya cacheados siguen disponibles.
10. Cambiar a inglés muestra la UI y los textos de datos en inglés.
11. En DevTools → Network no hay peticiones de datos a `pokeapi.co` desde el navegador.
12. Tras visitar páginas, modo avión: esas páginas se siguen viendo; aparece aviso "Sin conexión".
13. Más de N peticiones/minuto desde una IP → 429.
14. `http://localhost:4000/api/docs` (con `npm start` o Docker; `:3000/api/docs` si se ejecuta el BFF solo) muestra la API documentada.
15. `npm test` y `npm run e2e` pasan.

---

## 2. Stack

| Capa | Tecnología | Uso |
|---|---|---|
| Runtime | Node.js 24 LTS (`.nvmrc`) | Compatible con Angular 21 (`^20.19 \|\| ^22.12 \|\| >=24`) y NestJS 12 (`>=20`). |
| Monorepo | npm workspaces | Un `npm install`, sin tooling adicional. |
| Frontend | Angular 21: standalone, signals, zoneless (default v21), control flow, `HttpClient` + `withFetch()`, router con `withComponentInputBinding()` | APIs estables de v21. |
| SSR | `@angular/ssr@21`, `outputMode: server`, `RenderMode.Server`, hidratación + transfer cache | RNF-6. |
| i18n | `@angular/localize@21`, locale fuente `es`, traducción `en` (XLIFF) | RF-8. |
| PWA | `@angular/pwa@21` / `@angular/service-worker@21` | RF-9. |
| Estilos | SCSS propio (tokens con variables CSS, grid) | Sin librería UI. |
| BFF | NestJS 12 + Express | — |
| Config | `@nestjs/config` | Variables de entorno. |
| Validación | `class-validator` + `class-transformer` + `ValidationPipe` | Parámetros de entrada. |
| Base de datos | **Ninguna** (ver §10.1 #13) | La app solo lee de PokéAPI; no persiste datos propios. |
| Caché | `@nestjs/cache-manager` + `cache-manager` + Keyv; `@keyv/redis` y `cacheable` si hay `REDIS_URL` | RNF-2. |
| Rate limiting | `@nestjs/throttler` | RNF-4. |
| OpenAPI | `@nestjs/swagger` + plugin CLI | RNF-5. |
| HTTP saliente | `fetch` nativo de Node + `AbortSignal.timeout` | La doc oficial lo permite; evita `axios`. |
| Contratos | `packages/contracts` (solo tipos TS) | Contrato único web ↔ BFF. |
| Tests | Vitest en ambos (default de Angular 21 y de NestJS 12) · `@nestjs/testing` + `supertest` · Playwright + `@axe-core/playwright` (E2E y accesibilidad) | §9. |
| Lint | `oxlint` con reglas de tipos (BFF, default de NestJS 12) · ESLint + `angular-eslint@21` con reglas de accesibilidad de plantillas (web) | RNF-10. |
| Contenedores | Docker multi-stage + Docker Compose; Redis 8 | RNF-9. |
| CI | GitHub Actions (`.github/workflows/ci.yml`): lint, test, build, e2e, build de imágenes Docker | RNF-10. |

**APIs de Angular 21 excluidas a propósito:** `resource`, `rxResource`, `httpResource` y Signal Forms, porque están marcadas como *experimental* en la documentación de v21. Se usa `HttpClient` + RxJS + `toSignal`, que es estable. Los filtros usan controles nativos (`<input>`, `<select>`) enlazados a la URL, así que no hace falta una librería de formularios.

---

## 3. Arquitectura

### 3.1 Vista de contexto

```
                         ┌───────────────── producción (docker compose) ─────────────────┐
┌──────────────┐  HTML   │ ┌──────────────────┐  /api/*   ┌────────────────┐   ┌───────┐ │  HTTPS  ┌──────────────┐
│  Navegador   │ ──────▶ │ │ web SSR (Node)   │ ────────▶ │ BFF (NestJS)   │──▶│ Redis │ │ ──────▶ │ PokéAPI      │
│  + Service   │ ◀────── │ │ :4000 /es /en    │ ◀──────── │ :3000/api      │   └───────┘ │ ◀────── │ /api/v2      │
│    Worker    │  /api/* │ │ reenvía /api/*   │           └────────────────┘             │         └──────────────┘
└──────────────┘         │ └──────────────────┘                                          │
                         └───────────────────────────────────────────────────────────────┘
 desarrollo: `ng serve` (:4200) con proxy /api → :3000; caché en memoria, sin Redis.
 imágenes: URLs de raw.githubusercontent.com/PokeAPI/sprites, entregadas por el BFF.
```

- **Mismo origen para el navegador:** en desarrollo lo da el proxy de `ng serve`; en producción, el servidor SSR reenvía `/api/*` al BFF. No hace falta CORS.
- **SSR:** al renderizar en el servidor, el adaptador HTTP del front llama al BFF por la red interna (`BFF_URL`). La respuesta viaja al navegador con el transfer cache, así que no se repite la petición al hidratar.
- **Imágenes:** son archivos estáticos del repositorio oficial de sprites. El BFF decide la URL y el navegador solo las descarga.

### 3.2 Por qué un BFF (y no un proxy)

| Problema de PokéAPI para la UI | Qué hace el BFF |
|---|---|
| `/pokemon` lista solo `{name, url}`: sin id, imagen, tipos ni generación | Arma un **índice enriquecido** (id, nombre, nombres localizados, tipos, generación) con unas 30 llamadas a PokéAPI, cacheado 24 h. |
| No hay búsqueda parcial ni filtros combinados | Filtra el índice en memoria por texto, tipo y generación, y pagina. |
| El detalle está repartido en `pokemon` + `pokemon-species` + `evolution-chain` + `ability` + `stat` + `type` + `item` + `evolution-trigger` | Agrega todo en un único `PokemonDetail` (una llamada desde el front). |
| Respuestas grandes (~300 KB para un Pokémon) | DTOs de pocos KB con lo que muestra la pantalla. |
| Textos multilenguaje dispersos en `names[]` / `flavor_text_entries[]` | Elige el idioma pedido, con fallback a `en`, y limpia saltos de línea y caracteres de control. |
| Unidades en dm / hg | Convierte a m / kg. |
| Latencia y uso justo del servicio público | Caché (memoria/Redis), timeout y rate limiting propio. |

### 3.3 Estructura del repositorio

Nombres "intención sobre rol" (Angular 20+): `catalog.ts` → clase `Catalog`, sin sufijos `.component`.

```
/
├─ apps/
│  ├─ web/                                    # Angular 21 (SSR + i18n + PWA)
│  │  ├─ Dockerfile · ngsw-config.json · playwright.config.ts · eslint.config.js
│  │  ├─ scripts/translate-en.py              # genera messages.en.xlf desde messages.xlf
│  │  ├─ e2e/                                 # Playwright (+ fixtures: vigila que no haya llamadas a pokeapi.co)
│  │  ├─ test-support/fakes.ts                # FakeGateway para tests
│  │  ├─ public/                              # manifest.webmanifest, icons/
│  │  └─ src/
│  │     ├─ server.ts                         # Express SSR + reenvío /api/* → BFF_URL
│  │     ├─ proxy.conf.json                   # dev: /api/** → http://localhost:3000
│  │     ├─ locale/messages.xlf · messages.en.xlf
│  │     ├─ styles.scss + styles/             # ★ capa de estilos global: _tokens, _breakpoints, _reset, _base
│  │     └─ app/
│  │        ├─ app.{ts,html,scss}             # raíz: compone la plantilla AppShell
│  │        ├─ app.config.ts · app.config.server.ts · app.routes.ts · app.routes.server.ts
│  │        ├─ core/                          # api-origin (token + interceptor), connectivity, catalog-memory
│  │        ├─ pokemon/                       # dominio: puerto y adaptador de datos
│  │        │   ├─ application/pokemon-gateway.ts            # PUERTO
│  │        │   └─ infrastructure/http-pokemon-gateway.ts    # ADAPTADOR HttpClient → BFF
│  │        ├─ pages/                         # PÁGINAS (únicas que inyectan servicios)
│  │        │   catalog/ (+ catalog-params.ts: URL ⇄ estado) · pokemon-detail/ · not-found/
│  │        └─ ui/                            # ★ Atomic Design (solo presentacional)
│  │            atoms/       badge · button · meter · pokemon-image · skeleton · type-chip
│  │            molecules/   banner · evolution-stage · language-switch · pager · panel ·
│  │                         pokemon-card · search-field · select-field · stat-bar · state-message
│  │            organisms/   app-footer · app-header · catalog-filters · evolution-panel ·
│  │                         evolution-tree · pokemon-about · pokemon-grid · pokemon-hero · stats-panel
│  │            templates/   app-shell · page-layout
│  └─ bff/                                    # NestJS 12 (ESM, Vitest, oxlint)
│     ├─ Dockerfile · nest-cli.json (plugin Swagger) · .env.example
│     ├─ test/                                # e2e de controlador + fakes
│     └─ src/
│        ├─ main.ts · app.module.ts
│        ├─ config/configuration.ts           # variables de entorno tipadas y validadas
│        ├─ common/                           # memoizer (caché + anti-estampida), text, lang
│        └─ pokemon/
│           ├─ pokemon.module.ts              # binding puerto→adaptador
│           ├─ application/pokemon-source.port.ts    # PUERTO
│           ├─ application/pokemon.service.ts        # casos de uso
│           └─ infrastructure/
│              ├─ pokeapi.client.ts           # frontera HTTP: timeout, reintento, 404→null, 5xx→502
│              ├─ pokeapi.source.ts           # ADAPTADOR PokéAPI → modelo
│              ├─ pokeapi.types.ts · evolution-conditions.ts
│              ├─ pokemon.controller.ts · health.controller.ts · pokemon.dto.ts
├─ packages/contracts/src/index.ts            # DTOs compartidos (solo tipos)
├─ docker-compose.yml · .dockerignore · .github/workflows/ci.yml
├─ docs/SDD.md · .nvmrc
└─ package.json (workspaces + scripts) · README.md
```

★ = archivos pensados para el rediseño visual posterior (ver §7.6). La jerarquía de `ui/` sigue Atomic Design (§7.7).

---

## 4. Capa desacoplada (ambos lados)

**Puertos y adaptadores** (hexagonal ligero), con el mismo patrón en web y BFF:

```
          infraestructura (framework)                    aplicación (pura)            contratos
 BFF:  PokemonController ─▶ PokemonService ─▶ «PokemonSource»  ◀─ PokeApiSource
 Web:  CatalogPage / PokemonDetailPage ──────▶ «PokemonGateway» ◀─ HttpPokemonGateway
                                            todos usan tipos de @pokedex/contracts
```

- **Regla de dependencias:** las importaciones apuntan hacia adentro. `application` no importa `infrastructure`, ni `HttpClient`, ni `fetch`, ni formas de PokéAPI.
- **Puerto = clase abstracta.** En los dos frameworks, una clase abstracta es a la vez contrato TypeScript y token de inyección (NestJS *Custom providers → Interfaces and abstract classes*; Angular *Defining dependency providers*):

```ts
// BFF – pokemon.module.ts
providers: [PokemonService, { provide: PokemonSource, useClass: PokeApiSource }]
// Web – app.config.ts
providers: [{ provide: PokemonGateway, useClass: HttpPokemonGateway }]
```

- **Beneficio concreto:** los tests de casos de uso y de páginas sustituyen el adaptador por un *fake* en memoria. Para cambiar la fuente de datos solo se toca `PokeApiSource`; para cambiar el transporte del front, solo `HttpPokemonGateway`.
- **Conocimiento de PokéAPI:** solo existe en `pokeapi.source.ts`. Las formas de respuesta de PokéAPI no salen del adaptador.

---

## 5. Contratos (`packages/contracts`)

```ts
export type Lang = 'es' | 'en';

export interface NamedLabel { name: string; label: string }   // name: clave PokéAPI; label: texto en el idioma pedido

export interface PokemonSummary {
  id: number;
  name: string;            // clave PokéAPI ("mr-mime")
  label: string;           // nombre localizado ("Mr. Mime")
  imageUrl: string;        // sprite frontal
  types: NamedLabel[];
}

export interface Page<T> { items: T[]; total: number; offset: number; limit: number }

export interface CatalogFilters {
  types: NamedLabel[];         // solo tipos con Pokémon
  generations: { id: number; label: string }[];
}

export interface EvolutionNode {
  id: number;                  // id de especie
  name: string;
  label: string;
  imageUrl: string;
  conditions: string[];        // ya localizadas: ["Nivel 16"], ["Piedra Trueno"], ["Intercambio"]
  evolvesTo: EvolutionNode[];
}

export interface PokemonDetail {
  id: number;
  name: string;
  label: string;
  genus: string;               // "Pokémon Ratón"
  description: string;         // flavor text más reciente en el idioma pedido
  imageUrl: string;            // official-artwork (fallback: sprite frontal)
  thumbUrl: string;            // sprite de 96 px: marcador mientras llega imageUrl
  types: NamedLabel[];
  heightM: number;
  weightKg: number;
  abilities: (NamedLabel & { hidden: boolean })[];
  stats: (NamedLabel & { value: number })[];
  generation: { id: number; label: string };
  legendary: boolean;
  mythical: boolean;
}                              // la cadena evolutiva va aparte: GET …/:name/evolution (EvolutionNode)

export interface ApiError { statusCode: number; message: string | string[]; error?: string }
```

- Se importan siempre como `import type { … } from '@pokedex/contracts'`, así el paquete no se compila.
- En el BFF, `pokemon.dto.ts` declara clases `implements` de estas interfaces. El compilador las mantiene sincronizadas y Swagger (plugin CLI) las documenta.

---

## 6. BFF — diseño detallado

### 6.1 API

Prefijo global `/api`. Idioma: query `lang` (`es`|`en`); si no viene, se usa `Accept-Language`; por defecto `es`.

| Método | Ruta | Parámetros | 200 | Errores |
|---|---|---|---|---|
| GET | `/api/pokemon` | `q?` (≤ 50 car.), `type?` (clave), `generation?` (1–9), `offset` (≥ 0, def. 0), `limit` (1–60, def. 24), `lang?` | `Page<PokemonSummary>` | 400 validación · 429 · 502 |
| GET | `/api/pokemon/:name` | `name`: clave o número; `lang?` | `PokemonDetail` (sin evolución) | 404 · 429 · 502 |
| GET | `/api/pokemon/:name/evolution` | `name`: clave o número; `lang?` | `EvolutionNode` | 404 · 429 · 502 |
| GET | `/api/filters` | `lang?` | `CatalogFilters` | 429 · 502 |
| GET | `/api/health` | — | `{ status: 'ok' }` | — |
| GET | `/api/docs` | — | Swagger UI | — |

### 6.2 Puerto

```ts
export type Labels = Partial<Record<Lang, string>>;
export interface IndexEntry { id: number; name: string; types: string[]; generation: number | null; species: string | null }
export interface PokemonIndex {
  entries: IndexEntry[];                                  // ordenadas por id
  types: { name: string; labels: Labels }[];              // solo tipos con Pokémon
  generations: { id: number; labels: Labels }[];
}

export abstract class PokemonSource {
  abstract fetchIndex(): Promise<PokemonIndex>;
  abstract fetchDetail(nameOrId: string, lang: Lang, speciesHint?: string): Promise<PokemonDetail | null>; // null = no existe
  abstract fetchEvolution(nameOrId: string, lang: Lang, speciesHint?: string): Promise<EvolutionNode | null>;
  async warm(): Promise<void> {} // etiquetas y conexiones; nunca falla
}
```

El índice guarda las etiquetas de ambos idiomas: se construye y cachea una sola vez para los dos.

### 6.3 Casos de uso (`PokemonService`)

Todos devuelven `Cached<T> = { data, hit }` (el controlador traduce `hit` a `X-Cache`).

- **`list(query, lang)`**: índice vía `Memoizer` (clave `pokemon:index`, TTL 24 h; peticiones concurrentes comparten una sola carga). Filtra por texto, tipo y generación con un **índice de búsqueda precalculado** (`search.ts`: claves normalizadas una vez por índice; "Mr. Mime" ≡ `mr-mime`) y ordena por relevancia (exacto/número > prefijo > palabra > subcadena; a igual relevancia, por id). Solo si no hay ninguna coincidencia y la consulta tiene ≥ 4 caracteres devuelve nombres a distancia de edición ≤ 1 (`fuzzy: true`); un texto que se reduce a nada (`!!!`) devuelve 0 resultados. La caché de memoria (`config/cache-store.ts`) no serializa ni clona: antes cada lectura del índice costaba ≈1,3 ms; acota `limit` a 1–60; pagina con `slice`; arma `label` (nombre formateado), `imageUrl` y tipos localizados.
- **`detail(nameOrId, lang)` y `evolution(nameOrId, lang)`**: resuelven el nombre o número con el índice (solo si ya está en caché; nunca lo esperan), de modo que `25` y `pikachu` comparten entrada y la especie viaja como pista; el adaptador pide `pokemon` y `pokemon-species` **en paralelo** (una etapa). Se cachean con `Memoizer` en modo **stale-while-revalidate** (`CACHE_DETAIL_TTL_MS` 24 h fresco, `CACHE_DETAIL_STALE_MS` 7 d obsoleto; clave `pokemon:v2:…`): pasado el TTL se sirve el valor guardado y se refresca en segundo plano, y si PokéAPI falla se conserva el último valor. Las etiquetas (tipo, generación, estadística, habilidad, objeto) se guardan solo como `Labels` y las de tipos y generaciones se siembran desde el índice. `PokemonService.onApplicationBootstrap` calienta el índice y las etiquetas de estadísticas sin bloquear el arranque. `PokeApiClient` comparte las peticiones simultáneas a la misma URL (sin guardar el resultado). Cabecera del detalle: `public, max-age=3600, stale-while-revalidate=86400`.
- **`filters(lang)`**: tipos con Pokémon y generaciones, con su etiqueta.

### 6.4 Adaptador `PokeApiSource` y `PokeApiClient`

**`PokeApiClient`** (frontera HTTP, `infrastructure/`): `fetch` nativo con `AbortSignal.timeout`; un reintento (200 ms) ante 5xx, 429, error de red o timeout; 404 → `null`; el resto → `BadGatewayException('PokéAPI no disponible')` + `Logger.warn`; caché opcional por llamada (solo para recursos pequeños y repetidos: etiquetas); **solo sigue URLs del origen configurado** (las URLs vienen de datos externos).

**`fetchIndex`** (≈ 30 llamadas, en paralelo por fase):
1. `/pokemon?limit=100000`, `/type?limit=100`, `/generation?limit=100`.
2. `/type/{n}` por tipo → tipos de cada Pokémon (ordenados por `slot`) + etiquetas; se descartan tipos sin Pokémon.
3. `/generation/{n}` → especies por generación + etiquetas. Las formas (`pikachu-gmax`, `mr-mime-galar`, `deoxys-normal`) heredan la generación de su especie por **prefijo de nombre más largo**.

**`fetchDetail`**:
1. `/pokemon/{key}` (404 → `null`) **en paralelo** con `/pokemon-species/{pista}` (la especie viene del índice: `IndexEntry.species`, con la regla de prefijo más largo; si la pista falla o no es la del Pokémon, se cae al camino secuencial por `pokemon.species.url`). Después, las etiquetas de tipos, habilidades, estadísticas y generación (`Labels` cacheadas 24 h; las de tipos y generaciones las siembra `fetchIndex`, las de estadísticas `warm`). **No** incluye la cadena evolutiva.
2. Mapea: dm→m, hg→kg; artwork oficial con fallback a sprite; nombre localizado desde `species.names`; categoría (`genera`); descripción = último `flavor_text` en el idioma pedido (fallback `en`), con espacios/saltos colapsados; legendario/mítico.
3. **`fetchEvolution`** (endpoint aparte): especie (con la pista, sin pedir el Pokémon) → `evolution-chain` → recorrido recursivo; condiciones en `evolution-conditions.ts` (nivel, objeto, amistad, afecto, belleza, hora, movimiento, lugar, objeto equipado, intercambio, género, lluvia…), localizadas es/en, una cadena por forma alternativa. Los nodos se navegan por **id de especie** (más robusto que el nombre: `deoxys` vs `deoxys-normal`).
4. Una etiqueta secundaria caída no tumba el detalle: se usa la clave formateada.

**Límite conocido:** los nombres de Pokémon del catálogo y de la cadena evolutiva se derivan de la clave (`mr-mime` → "Mr Mime"); el nombre oficial localizado solo se obtiene en el detalle (PokéAPI lo entrega por especie y pedirlo para 1.350 especies costaría 1.350 llamadas). En es/en coinciden en la gran mayoría.

### 6.5 Controlador y transversales

- `PokemonController` (HTTP in/out únicamente): `ListPokemonQueryDto` / `LangQueryDto` / `PokemonParamDto` con `class-validator`; parámetros vacíos (`?q=&gen=`) se tratan como ausentes; `lang` por `?lang` → `Accept-Language` → `es`; `null` del servicio → `NotFoundException('Pokémon no encontrado')`; respuestas con `X-Cache: HIT|MISS`, `Cache-Control: public, max-age=300` y `Vary: Accept-Language`.
- `HealthController`: `GET /api/health` → `{status:'ok'}` (liveness para Docker; sin throttling; no consulta PokéAPI).
- `main.ts`: `trust proxy` configurable, prefijo `api`, `ValidationPipe({ whitelist: true, transform: true })`, Swagger en `/api/docs`, `enableShutdownHooks()`.
- `ThrottlerModule` + `ThrottlerGuard` global: por IP, **240 peticiones/min** por defecto (la búsqueda por tecleo con debounce puede generar varias por segundo).
- `CacheModule.registerAsync`: memoria (`CacheableMemory`, LRU 5.000) y, con `REDIS_URL`, también Redis; errores de Redis se registran y **nunca rompen la petición** (`Memoizer` los trata como fallo de caché).
- Configuración tipada (`configuration.ts`): una variable inválida detiene el arranque con un mensaje claro.

---

## 7. Frontend — diseño detallado

### 7.1 Rutas

| Ruta (bajo `/es` o `/en`) | Componente (lazy) | Render | Estado en URL |
|---|---|---|---|
| `''` | `Catalog` | `RenderMode.Server` | `?q=&type=&gen=&page=` |
| `pokemon/:name` | `PokemonDetailPage` | `RenderMode.Server` (404 real si no existe) | `name` (clave o número) |
| `**` | `NotFound` | `RenderMode.Server`, `status: 404` | — |

Las páginas leen la URL con `ActivatedRoute.queryParamMap` / `paramMap` (observables que emiten de forma síncrona) en lugar de `withComponentInputBinding`: no depende de `effect`, así que el SSR espera los datos sin sorpresas.

### 7.2 Puerto y adaptador

```ts
export abstract class PokemonGateway {
  abstract list(query: CatalogQuery): Observable<Page<PokemonSummary>>;
  abstract filters(): Observable<CatalogFilters>;
  abstract detail(nameOrId: string | number): Observable<PokemonDetail>;   // 404 → HttpErrorResponse
}
```

`HttpPokemonGateway` pide siempre rutas relativas `/api/…` y añade `lang` desde `LOCALE_ID`. Ninguna página inyecta `HttpClient`.

- **`API_ORIGIN` + `apiOriginInterceptor`:** en el navegador es `''`; en el servidor SSR es `BFF_URL`. El interceptor reescribe `/api/…` a absoluta **solo en el servidor** y reenvía la IP del visitante (`REQUEST_CONTEXT.clientIp` → `X-Forwarded-For`), porque el límite del BFF es por IP. Queda después del transfer cache de `HttpClient`, de modo que la clave de caché es la misma en servidor y navegador y no se repite la petición al hidratar.
- **`server.ts`:** reenvía `/api/*` al BFF (solo GET/HEAD; 405 para el resto; 502 si el BFF cae), sirve estáticos y delega el resto a `AngularNodeAppEngine`, pasando `clientIp` como contexto.

### 7.3 `Catalog` (RF-1, RF-2, RF-4, RF-5)

- **Filtros:** búsqueda (`<input type="search">` con `<label>`; mínimo 2 caracteres, salvo un dígito, con pista accesible; debounce 250 ms cancelable; Enter busca al instante, Escape y vaciar limpian; `replaceUrl` para no llenar el historial). Mientras llega una búsqueda se **conservan los resultados anteriores atenuados** (`aria-busy`, «Buscando…») en lugar del esqueleto, y `CachedPokemonGateway` (decorador del puerto: clave canónica, LRU de 30, TTL 5 min, deduplicación en vuelo) evita repetir consultas, `<select>` de tipo y de generación (opciones desde `filters()`; si ese endpoint falla, solo se ocultan los selects) y "Limpiar filtros". Cada cambio actualiza la URL y vuelve a la página 1. El campo se sincroniza con la URL (atrás/adelante, limpiar) sin pisar lo que se está tecleando.
- **La URL es la única fuente de verdad** (`catalog-params.ts`: parseo, serialización mínima, `offset` de la API). Recargar, compartir y "volver" funcionan.
- **Tarjetas** (`PokemonCard`): enlace con imagen `loading="lazy"` de 96×96 (sin saltos de layout; placeholder si falla), `#NNN`, nombre y chips de tipo.
- **Paginación** (`Pager`): `<div routerLink>` con `?page=N` (`queryParamsHandling="merge"`, conserva búsqueda y filtros); accesible por teclado (§7.8). Se renderiza en el servidor, pero la navegación requiere JavaScript.
- **Estados (RF-10):** esqueleto, vacío ("Sin resultados" + limpiar filtros), página inexistente (enlace a la primera), error con `role="alert"` y "Reintentar"; contador con `role="status"` y plural ICU.
- `CatalogMemory` (servicio raíz) recuerda la última URL del catálogo para el enlace "Volver" del detalle.

### 7.4 `PokemonDetailPage` (RF-3, RF-6, RF-7)

- **Precarga de evoluciones:** con la evolución cargada se calientan en reposo las ≤ 4 etapas más cercanas y la intención (cursor/foco/toque) sobre una etapa precarga la suya; la cadena se siembra en la caché de evolución para todas sus etapas (SDD-DETALLE §6.8).
- **Evolución en la cabecera:** el `evolution-panel` (compacto, sin tarjeta) se proyecta en la ranura `[heroAside]` del `pokemon-hero`, a la derecha de la identidad (el hero sigue siendo presentacional y no importa otros organismos). El árbol tiene variante `compact` (miniatura de 48 px, condiciones de 5 rem, ramas en filas que bajan de línea según el ancho). Con un contenedor de menos de 64 rem la columna baja bajo la identidad (container query) y en pantallas ≤ 40 rem el árbol vuelve a su disposición vertical. Si el Pokémon no evoluciona, la columna desaparece. No hay otro panel de evolución en la página. Con más de 3 ramas en un nodo (Eevee) el árbol usa una rejilla (4 columnas, 2 en móvil) bajo la etapa de origen y las condiciones se pliegan tras «+N más» (`evolution-conditions`).
- **Carga en dos partes:** el núcleo (`GET /api/pokemon/:name`) y la evolución (`…/evolution`) se piden por separado y fallan por separado (el panel de evolución muestra su skeleton y, si falla, «Reintentar»). La evolución solo se pide en el navegador: el SSR responde con el núcleo.
- **Navegación optimista:** al abrir una tarjeta, `NavigationHint` guarda su resumen y la cabecera se pinta al instante (número, nombre, tipos y miniatura) mientras llega el resto. Con el cursor o el foco sostenidos 150 ms sobre una tarjeta (o al tocarla), `CachedPokemonGateway.prefetchDetail` precarga el núcleo (≤ 2 en vuelo, 1 por Pokémon, nada con `saveData`).
- **Imagen del hero:** `pokemon-image` muestra la miniatura detrás del artwork hasta que este carga y lo pide con `fetchpriority="high"`.
- **Transfer cache:** `apiOriginBackend` (en `app.config.server.ts`) reescribe `/api/…` a la URL interna del BFF **por debajo** de los interceptores. Antes un interceptor lo hacía por encima del transfer cache y la clave del servidor (URL absoluta) no coincidía con la del navegador (relativa): toda carga directa repetía sus peticiones. Ahora el HTML ya trae el detalle y el catálogo y el navegador no los vuelve a pedir.
- **Red y service worker:** el servidor web comprime con gzip/brotli (`compression`); `ngsw-config.json` sirve el detalle con `performance` (caché primero, 1 h) y las rutas lazy se precargan (`PreloadAllModules`).
- Cabecera con artwork, `#id`, nombre, categoría, chips de tipo, generación y marcas de legendario/singular.
- "Acerca de" (descripción, altura, peso, habilidades como chips, la oculta con icono; descripción y datos en dos zonas; FE-015), "Estadísticas base" (barras `role="meter"` 0–255 coloreadas por tramo, con guías y entrada animada, y un resumen del total con su nivel en una segunda zona; FE-016) y "Evolución".
- `EvolutionTree`: componente recursivo (`<ul>` anidadas accesibles) con condición localizada y texto solo-lectores ("Evoluciona a X:"); cada etapa navega por id y la actual lleva `aria-current="page"`.
- **404 de verdad en SSR:** el `HttpErrorResponse` 404 fija `RESPONSE_INIT.status = 404`; otros errores muestran alerta con "Reintentar" y no tocan el status. `Title` y `meta description` por Pokémon.

### 7.5 i18n y PWA

- **i18n:** atributos `i18n="@@id"` con ids estables y `$localize` en TS. `npm run i18n -w apps/web` ejecuta `ng extract-i18n` y `scripts/translate-en.py` (falla si falta alguna traducción) → `messages.xlf` / `messages.en.xlf`. Build con `localize` y `subPath` `es`/`en`; `i18nMissingTranslation: error`. El servidor SSR redirige `/` según `Accept-Language`. El selector de idioma son enlaces (`appHardLink`, recarga completa) a la misma ruta en el otro locale (`/es/x` ↔ `/en/x`).
- **Desarrollo:** `ng serve` sirve un solo idioma en la raíz, por eso el selector se oculta con `isDevMode()`; `npm run dev` (es) y `npm run dev:en` (en). El cambio de idioma se prueba con `npm start` o Docker.
- **PWA:** `ngsw-config.json` con `index: /index.csr.html` (shell de cliente), assets, sprites de `raw.githubusercontent.com` (lazy) y `dataGroups` de `/api` con `freshness` (5 s de timeout, 1 día, 200 entradas). Con el SW activo las navegaciones se renderizan en cliente y los datos consultados quedan en caché: la última página vista sigue disponible sin red. `Connectivity` (señal `online`/`offline`) muestra el aviso "Sin conexión"; `SwUpdate` muestra "Hay una nueva versión disponible" con botón "Actualizar".

### 7.6 UI, accesibilidad y capa de estilos (preparada para el rediseño)

- **Estética propia, no Pokédex (PDF-11):** fondo neutro, tarjetas con borde suave, color solo en los chips de tipo; modo claro/oscuro con `prefers-color-scheme`.
- **Los estilos están aislados de la lógica** para poder rediseñar después sin tocar TypeScript ni la estructura de las plantillas:
  1. `src/styles/_tokens.scss`: **única fuente** de colores (claro/oscuro), tipografía (tamaños, pesos, interlineados, tracking), espaciado, radios, grosores de borde y anillo de foco, opacidades, capas (`z`), sombras, movimiento (transiciones, entrada, escalonado, shimmer), dimensiones transversales (cabecera, controles, iconos, medidas de lectura, columnas laterales), colores por tipo y tramos de estadísticas (contraste AA verificado con script). Los puntos de ruptura no pueden ser variables CSS: viven en `src/styles/_breakpoints.scss` (Sass: `$sm/$md/$lg` y los mixins `down`, `above`, `container-down`, disponibles con `@use 'breakpoints' as bp` gracias a `stylePreprocessorOptions.includePaths`). El color de marca y de fondo del manifest y de `index.html` (JSON/HTML no leen CSS) se verifican contra los tokens.
  2. `src/styles/_reset.scss` y `_base.scss`: reset, `.container`, `.visually-hidden`, `.button`, foco visible.
  3. `ui/*` (átomos, moléculas, organismos, plantillas): componentes **solo presentacionales** (reciben datos por `input()` y emiten por `output()`, no inyectan servicios); cada uno con su `.scss` que consume únicamente tokens.
  4. `*.scss` de páginas y plantillas: layout.

  Reglas: ningún valor de color, tipografía, borde, sombra, opacidad, capa, duración ni ancho de media query fuera de los tokens (lo hace cumplir `apps/web/scripts/check-tokens.test.mjs`, que corre en `npm test`: también falla si se usa un `var(--x)` que no existe, si el modo oscuro no redefine un color del claro o si faltan los tokens de los 18 tipos); la lógica nunca depende de clases CSS; los componentes de `ui/` no conocen el dominio más allá de los contratos.
- **Accesibilidad (verificada con axe, WCAG 2.1 AA, en es y en):** `<label>` en filtros, foco visible, *skip link* (con manejo propio por el `<base href>`), `lang` por locale, `role="status"`/`role="alert"`, todo operable con teclado, `prefers-reduced-motion`, imágenes decorativas con `alt=""` y artwork con `alt` del nombre.
- **Responsive:** mobile-first; sin scroll horizontal a 320 px (verificado en E2E).

### 7.7 Componentes reutilizables (Atomic Design)

`app/ui/` se organiza en cinco niveles; las importaciones solo apuntan hacia abajo y **ESLint lo hace cumplir** (`eslint.config.js`).

| Nivel | Qué es | Componentes | Puede depender de |
|---|---|---|---|
| Átomos | Elemento indivisible | `badge`, `button` (selector de atributo sobre `button`/`div`/`span`/`a`), `link` (directivas `RouterLinkRole` y `HardLink`), `meter`, `pokemon-image` (tamaño reservado + marcador si falla), `skeleton` (formas `block/text/circle/image/chip`; los organismos de datos lo usan cuando no reciben datos, FE-009), `text` (`app-text`: etiqueta dinámica; peso/variante/tono por tokens en `styles/_typography.scss`), `type-chip` | nada de `ui/` |
| Moléculas | Pocos átomos con un propósito | `banner`, `evolution-stage`, `language-switch`, `pager`, `panel`, `pokemon-card`, `search-field`, `select-field`, `stat-bar`, `state-message` | átomos |
| Organismos | Sección completa de la interfaz | `app-header`, `app-footer`, `catalog-filters` (debounce de la búsqueda), `pokemon-grid`, `pokemon-hero`, `pokemon-about`, `stats-panel`, `evolution-panel`, `evolution-tree` (recursivo) | átomos y moléculas (+ tipos de `@pokedex/contracts`) |
| Plantillas | Esqueleto con ranuras, sin datos | `app-shell` (cabecera, avisos, contenido, pie), `page-layout` (barra superior + contenido) | `ng-content` |
| Páginas | Plantilla + datos reales | `Catalog`, `PokemonDetailPage`, `NotFound` y la raíz `App` | todo lo anterior + servicios (`PokemonGateway`, `Router`, `CatalogMemory`) |

Reglas: (1) solo las páginas inyectan servicios o conocen la URL; (2) los componentes de `ui/` nunca importan `core/`, `pokemon/`, `pages/` ni `HttpClient`; (3) un componente nuevo se coloca en el nivel más bajo que lo permita y compone, no duplica (p. ej. toda imagen de Pokémon usa `pokemon-image`); (4) cada componente reutilizable lleva su `*.spec.ts` aislado; (5) el texto usa `<app-text>` (no para `li`/`dt`/`dd`/`option`) y la tipografía solo sale de tokens (FE-008).

### 7.8 Enlaces: `<div>` con `routerLink`

Decisión del solicitante: **no se usan `<a href>`**; la navegación se hace con elementos `<div>` (o `<span>` dentro de texto en línea).

| Destino | Elemento | Mecanismo |
|---|---|---|
| Ruta de la app (tarjeta, etapa evolutiva, paginación, marca, «Volver», «Ir al catálogo») | `<div routerLink="…">` | `RouterLink` de Angular + `RouterLinkRole` |
| Otro idioma (`/es/…` ↔ `/en/…`) o sitio externo (PokéAPI, en el pie) | `<div appHardLink="url">` / `<span appHardLink="url" target="blank">` | `HardLink`: `location.assign` o `window.open` con `noopener` |
| «Saltar al contenido» | `<div role="link" tabindex="0">` | enfoca `<main>` con clic o Enter |

- Átomo `ui/atoms/link/link.ts`: `RouterLinkRole` (selector `[routerLink]:not(a):not(area)`) añade `role="link"` y la activación con **Enter**; `RouterLink` ya navega con el clic y asigna `tabindex="0"` a elementos no nativos. `HardLink` añade `role="link"`, `tabindex="0"`, clic y Enter (Ctrl/⌘+clic abre pestaña nueva). Se importa con `ROUTER_LINK` en lugar de `RouterLink` suelto.
- Los textos se leen como «enlace» (`role="link"`), son enfocables con Tab y pasan axe WCAG 2.1 AA; los E2E siguen localizándolos con `getByRole('link')`.
- **Consecuencias asumidas:** sin `href` no hay «abrir en nueva pestaña» desde el menú contextual ni clic central en los enlaces internos, el destino no aparece al pasar el cursor, y los enlaces de navegación no son rastreables por buscadores ni funcionan sin JavaScript (el contenido sí se renderiza en el servidor). Los enlaces `rel="prev|next"` de la paginación se eliminaron. Si en el futuro importa el SEO de la paginación, la alternativa es volver a `<a routerLink>` solo en el paginador.
- Un `<div>` dentro de un `<p>` es HTML inválido y rompe la hidratación del SSR: en texto en línea (pie de página) se usa `<span>`.

---

## 8. Configuración, ejecución y revisión

### 8.1 Requisitos

| Requisito | Versión | Para |
|---|---|---|
| Node.js | 24 LTS (`.nvmrc`; `nvm use`) | Ejecución local |
| npm | ≥ 10 | Workspaces |
| Docker + Compose | Opcional | Ejecución con contenedores / Redis |

### 8.2 Variables de entorno

Todas son opcionales y tienen un valor por defecto; `apps/bff/.env.example` las documenta (Node no carga `.env` solo: se exportan en el shell o las define Docker Compose). No hay secretos: PokéAPI es pública. Un valor inválido detiene el arranque con un mensaje claro.

| Variable | App | Default | Uso |
|---|---|---|---|
| `PORT` | bff | `3000` | Puerto del BFF |
| `POKEAPI_BASE_URL` | bff | `https://pokeapi.co/api/v2` | Origen de datos (único origen que sigue el cliente) |
| `POKEAPI_TIMEOUT_MS` | bff | `5000` | Timeout por llamada saliente |
| `SPRITES_BASE_URL` | bff | `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon` | Base de las imágenes |
| `REDIS_URL` | bff | — (solo memoria) | Activa Redis además de la memoria |
| `CACHE_INDEX_TTL_MS` | bff | `86400000` | TTL del índice |
| `CACHE_DETAIL_TTL_MS` | bff | `3600000` | TTL del detalle |
| `CACHE_LABEL_TTL_MS` | bff | `86400000` | TTL de etiquetas (tipos, habilidades, stats…) |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | bff | `60000` / `240` | Límite de peticiones por IP |
| `TRUST_PROXY` | bff | `false` | `1` detrás del servidor web (lee `X-Forwarded-For`; Compose lo activa) |
| `PORT` | web (SSR) | `4000` | Puerto del servidor SSR |
| `BFF_URL` | web (SSR) | `http://localhost:3000` | BFF para SSR y reenvío de `/api` |

### 8.3 Scripts raíz

| Script | Acción |
|---|---|
| `npm install` | Instala todo el monorepo |
| `npm run dev` / `dev:en` | BFF (`nest start --watch`) + web (`ng serve`, es / en) en paralelo (`concurrently`) |
| `npm run build` | Build de producción de ambos (web con SSR y los dos locales) |
| `npm start` | Ejecuta los builds (web SSR `:4000` + BFF `:3000`) |
| `npm test` | Tests unitarios y e2e de controlador (BFF) + tests del web |
| `npm run e2e` | Playwright contra `npm start` (requiere `npm run build` y `npx playwright install chromium`) |
| `npm run lint` | oxlint (BFF) + ESLint (web) |
| `npm run i18n -w apps/web` | Extrae mensajes y regenera la traducción al inglés |
| `docker compose up --build` | Web SSR + BFF + Redis en `http://localhost:4000` |

Con Docker el BFF **no se publica** en el host: solo es alcanzable a través del servidor web, incluidos `/api/health` y `/api/docs`.

### 8.4 Cómo revisar (para el README)

Recorrido sugerido según §1.4; puntos de entrada del código: `pokemon-source.port.ts` → `pokemon.service.ts` → `pokeapi.source.ts` (BFF) y `pokemon-gateway.ts` → `catalog.ts` → `pokemon-detail.ts` (web); Swagger en `/api/docs`; la cabecera `X-Cache` muestra la caché en acción.

---

## 9. Calidad y pruebas

### 9.1 Tests (todos pasan)

| Suite | Casos | Qué verifica |
|---|---|---|
| BFF · `pokemon.service.spec.ts` (fake `PokemonSource`) | 7 | búsqueda parcial, sin acentos ni separadores; filtros tipo/generación combinados; paginación, `total` y límite acotado; etiquetas con fallback a inglés; índice construido una sola vez con peticiones concurrentes; detalle normalizado y cacheado por idioma (incluido el 404) |
| BFF · `pokeapi.source.spec.ts` (`fetch` simulado) | 11 | índice: tipos por slot, tipos sin Pokémon descartados, generación de formas por prefijo; detalle: unidades, idioma + fallback, limpieza de textos, árbol evolutivo con ramas y condiciones, etiqueta secundaria caída; cliente: reintento, 5xx → 502, red/timeout → 502, origen ajeno rechazado |
| BFF · `common.spec.ts` | 5 | normalización de texto y resolución de idioma |
| BFF · `test/pokemon.e2e-spec.ts` (`supertest`, fuente falsa) | 6 | paginación/filtros, validación 400, parámetros vacíos, detalle y 404, filtros, 429 (el health check no cuenta) |
| Web · `catalog-params.spec.ts` | 6 | URL ⇄ estado del catálogo |
| Web · `http-pokemon-gateway.spec.ts` | 5 | URLs, parámetros, idioma por `LOCALE_ID`, escape de rutas |
| Web · `catalog.spec.ts` (fake gateway) | 10 | consulta desde la URL, filtros reflejados, vacío, página inexistente, error + reintento, esqueleto, búsqueda con debounce, resultados anteriores conservados, aviso aproximado |
| Web · `pokemon-detail.spec.ts` | 5 | ficha completa, etapa actual y enlaces por id, 404 (+ `RESPONSE_INIT`), error, carga |
| Web · `pager.spec.ts` | 4 | extremos, navegación por clic y por Enter conservando la búsqueda, página única |
| Web · componentes de `ui/` (átomos, moléculas, organismos) | 27 | enlaces (`div[routerLink]` y `appHardLink`: rol, `tabindex`, clic/Enter), `language-switch`, `pokemon-image` (tamaño, alt, carga, fallo y recuperación), `button`, `type-chip`, `search-field` (emite, sigue el valor externo, no pisa lo que se escribe), `select-field`, `panel`, `catalog-filters` (debounce, sin emisiones redundantes, tipo/generación, ocultar selectores), `evolution-tree` (ramas, navegación por id con clic y Enter, etapa actual en formas), `pokemon-grid`, `stats-panel` |
| Web · detalle (`cached-pokemon-gateway` detalle/precarga, `navigation-hint`, `api-origin`, tarjeta, hero, imagen, panel de evolución, página) | 38 | caché y precarga acotada, resumen consumido una vez, reescritura de origen, intención con temporizador, hero parcial, miniatura, evolución independiente (marcador, error, solo navegador) |
| BFF · detalle (`detail-cost`, `memoizer`, servicio, adaptador, e2e) | 36 | 1 etapa y ≤ 2 llamadas (latencia virtual), SWR y stale-if-error, resolución por número/forma, clave compartida, calentamiento, etiquetas sembradas, endpoint de evolución |
| Web · búsqueda (`search-query`, `cached-pokemon-gateway`, `catalog-filters`, `search-field`) | 29 | paridad con el BFF, normalización, regla de emisión (2 caracteres, Enter, Escape, cancelación), caché (clave canónica, dedupe, TTL, LRU, errores) |
| BFF · búsqueda (`search.spec.ts`, `search-cost.spec.ts`, e2e) | 26 | relevancia, número, erratas, `!!!`, límites, 304/`Vary`, coste determinista (1 construcción por índice, 1 normalización por petición) |
| **Playwright** (`e2e/`, PokéAPI real) | 50 | catálogo, paginación persistente, búsqueda parcial, filtros combinados, vacío, error recuperable, flujo buscar→detalle→volver con estado, ramas (Eevee), acceso por número, 404 reales (HTTP), idiomas (redirección, datos y UI en inglés, selector), SSR, axe WCAG 2.1 AA (4 páginas), sin scroll horizontal a 320 px, modo sin conexión, manifest, y **ninguna llamada del navegador a `pokeapi.co`** (fixture automático) |

Los E2E se ejecutaron contra `npm start` y contra Docker Compose (Redis incluido).

### 9.2 CI (`.github/workflows/ci.yml`)

En cada push y pull request, con Node 24 (`.nvmrc`) y caché de npm:

| Job | Acción |
|---|---|
| `verify` | `npm ci` → `npm run lint` → `npm test` |
| `e2e` (necesita `verify`) | `npm ci` → `npm run build` → instala Chromium → `npm run e2e`; sube el reporte HTML si falla |
| `docker` (necesita `verify`) | `docker compose build` (verifica que los Dockerfile construyen) |

No se publican imágenes ni se despliega: la entrega se ejecuta localmente (npm o Docker). Los E2E dependen de la disponibilidad de PokéAPI (2 reintentos en CI).

### 9.3 Librerías y herramientas (para el README)

- Las dependencias de §2, con su motivo.

---

## 10. Decisiones y limitaciones

### 10.1 Decisiones

1. **Alcance completo** por decisión del solicitante: el tiempo de referencia no recorta funcionalidades.
2. **Docker como forma de ejecución completa** (web SSR + BFF + Redis); sin despliegue en un hosting público.
3. **BFF con índice enriquecido en caché:** habilita búsqueda parcial y filtros combinados que PokéAPI no ofrece, con ≈ 30 llamadas en vez de 1.350.
4. **Agregación del detalle en el BFF:** el front hace una petición por pantalla; las ≈ 8 fuentes de PokéAPI quedan ocultas tras el contrato.
5. **Puertos como clases abstractas en ambos lados:** desacopla la lógica del framework y del transporte con la DI nativa, sin tokens string ni librerías.
6. **Contratos solo de tipos + clases DTO que los implementan en el BFF:** un único contrato, sin build, y OpenAPI automática.
7. **Solo APIs estables de Angular 21:** se evitan `httpResource`, `resource` y Signal Forms (experimentales en v21).
8. **Estado del catálogo en la URL:** recarga, enlaces compartibles y "volver" sin store global.
9. **Caché en dos niveles** (memoria siempre, Redis opcional), con carga compartida entre peticiones concurrentes y tolerancia a fallos del almacén.
10. **`fetch` nativo** en vez de `axios`: menos dependencias, con timeout, reintento y filtro de origen.
11. **Mismo origen siempre** (proxy en dev, reenvío en SSR): sin CORS. El BFF no se publica con Docker.
12. **SSR + i18n por subruta + PWA:** SEO y primera carga rápidas, con 404 reales y soporte offline.
13. **Sin base de datos (ni TypeORM/PostgreSQL):** la aplicación no escribe ni almacena datos propios; todo es lectura de PokéAPI y el rendimiento lo resuelve la caché (memoria/Redis). Una base de datos añadiría una dependencia y un contenedor sin función real. Si en el futuro hay datos propios (favoritos, historial) o se quiere servir con PokéAPI caída, encaja detrás del puerto `PokemonSource` (un adaptador nuevo) o como un módulo nuevo del BFF, sin tocar la capa de aplicación ni el contrato del front.
14. **Capa de estilos aislada** (tokens + componentes presentacionales) para rediseñar la interfaz sin tocar la lógica (§7.6).
15. **Límite de peticiones por visitante real:** el servidor web reenvía la IP (`X-Forwarded-For`) y el BFF confía solo un salto; no se puede esquivar falsificando la cabecera.

### 10.2 Limitaciones conocidas

- El índice se refresca cada 24 h (configurable): un Pokémon nuevo en PokéAPI aparece al expirar la caché o al reiniciar.
- Sin Redis, la caché vive en el proceso: se pierde al reiniciar y no se comparte entre instancias.
- El catálogo incluye las formas alternativas que lista PokéAPI (`pikachu-gmax`, ids > 10000) al final del orden por id; su generación se deduce por prefijo de nombre (cubierto por test).
- Nombres de Pokémon del catálogo y de la cadena evolutiva derivados de la clave; el nombre oficial localizado solo aparece en el detalle (§6.4).
- Con muchas ubicaciones de evolución (p. ej. Leafeon/Glaceon) la lista de condiciones es larga; es correcta, pero la presentación puede mejorarse en el rediseño.
- `ng serve` sirve un solo idioma y sin selector; el cambio de idioma se prueba con `npm start` o Docker.
- Las descripciones dependen de que PokéAPI tenga texto en el idioma pedido; si no, se muestran en inglés.
- Los E2E usan la PokéAPI real: si el servicio público está caído, fallan.

---

## 11. Plan de implementación (estado)

| # | Fase | Estado |
|---|---|---|
| 1 | Monorepo: workspaces, `.nvmrc`, `nest new`, `ng new` (v21, SCSS, SSR), `contracts`, scripts, lint | ✔ |
| 2 | BFF núcleo: puerto, adaptador (índice + detalle), servicio, controlador, DTOs, validación, caché | ✔ |
| 3 | BFF transversal: Swagger, throttler, Redis opcional, cabeceras de caché, health | ✔ |
| 4 | BFF tests (unitarios + e2e de controlador) | ✔ |
| 5 | Web núcleo: puerto, adaptador, rutas, proxy, shell | ✔ |
| 6 | Catálogo: búsqueda, filtros, grilla, paginación, estados | ✔ |
| 7 | Detalle: datos, stats, evolución, estados | ✔ |
| 8 | SSR (reenvío `/api`, `API_ORIGIN`, status 404, IP del visitante) | ✔ |
| 9 | i18n (marcado, extracción, traducción al inglés, selector) | ✔ |
| 10 | PWA (manifest, iconos, `ngsw-config`, aviso offline/actualización) | ✔ |
| 11 | Estilos base (tokens, modo oscuro, accesibilidad AA verificada con axe) | ✔ (rediseño posterior previsto) |
| 12 | Tests web + Playwright E2E | ✔ |
| 13 | Docker, Compose, GitHub Actions | ✔ (Compose verificado localmente; el workflow se ejecutará al publicar el repositorio) |
| 14 | README y publicación del repositorio público en GitHub | README ✔ · publicación pendiente |

## 12. Referencias

- PokéAPI: https://pokeapi.co/docs/v2
- Angular 21: https://v21.angular.dev · `llms-full.txt`: https://v21.angular.dev/assets/context/llms-full.txt · SSR: https://v21.angular.dev/guide/ssr · i18n: https://v21.angular.dev/guide/i18n · Service worker: https://v21.angular.dev/ecosystem/service-workers
- NestJS: https://docs.nestjs.com · `llms.txt`: https://docs.nestjs.com/llms.txt · Caching: https://docs.nestjs.com/data/caching.md · Custom providers: https://docs.nestjs.com/fundamentals/custom-providers.md

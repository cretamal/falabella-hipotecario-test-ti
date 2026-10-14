# SDD · Carga del detalle de un Pokémon (frontend + backend)

> **Estado:** **implementado y verificado** · versión 1.1 · 2026-10-14 (resultados reales en §13)
> **Documento base:** [`SDD.md`](SDD.md) (§5 contratos, §6 BFF, §7 web). Al implementarse, los cambios se vuelcan al SDD base.
> **Seguimiento:** [BE-007](mejoras/BACKEND.md) y [FE-011](mejoras/FRONTEND.md). Absorbe [BE-002](mejoras/BACKEND.md) (calentamiento) y [BE-003](mejoras/BACKEND.md) (datos obsoletos si PokéAPI cae) para el detalle.
> **Antecedente:** mismo método que [`SDD-BUSQUEDA.md`](SDD-BUSQUEDA.md): línea base medida → presupuestos → puertas de regresión deterministas.

---

## 1. Objetivo y alcance

Reducir al máximo el tiempo y la carga de `/pokemon/:name`, tanto con la caché del BFF fría como caliente, y que el usuario perciba respuesta inmediata al abrir un Pokémon.

| Dentro | Fuera |
|---|---|
| Cadena de llamadas a PokéAPI del detalle (BFF) | Catálogo e índice (ya optimizados en `SDD-BUSQUEDA.md`) |
| Contrato del detalle (núcleo + evolución) | Rediseño visual (FE-001) |
| Caché, calentamiento y datos obsoletos del detalle | Endpoint de imágenes con redimensionado (F7 del análisis): solo si §13 lo exige |
| Compresión, service worker, precarga y navegación optimista (web) | Cambios de infraestructura (CDN, nginx) |

## 2. Línea base (medida, PokéAPI real, 2026-10-13)

**BFF, detalle con caché fría** (perfilado llamada por llamada con `fetch` instrumentado):

| Pokémon | Total | Llamadas | Etapas secuenciales |
|---|---|---|---|
| Eevee | 1.295 ms | 19 | 4 |
| Charizard | 760 ms | 14 | 3–4 |

Etapas de Eevee: `pokemon` (578 ms, de los cuales ≈400 ms son DNS+TLS de la primera conexión; ≈160 ms con la conexión abierta) → `pokemon-species` (294 ms) → en paralelo `evolution-chain` + 6 `stat` + 2 `ability` + `type` + `generation` (≈160 ms) → 5 `item` de las condiciones de evolución (≈240 ms).
**Con las etiquetas cacheadas** quedan 3 llamadas secuenciales (`pokemon` → `species` → `chain`): **380–600 ms**.

**Con caché caliente:** BFF 3 ms · navegar catálogo → detalle 72 ms · SSR del detalle 15–60 ms.
**Navegador, catálogo → detalle en frío (Dragonite):** 1.363 ms hasta ver el título.

**Otros hallazgos:**
- **Sin compresión** en ningún sitio: el HTML del SSR pesa 34.128 B (7.083 B con gzip −9, −79 %); `main` pesa 15.609 B (5.733 B, −63 %).
- La imagen del hero es el artwork oficial de **142 KB** (Eevee) para una caja de 280 px, desde `raw.githubusercontent.com` con `max-age=300`; la miniatura del catálogo pesa 582 B y ya está en memoria. El `<img>` del hero usa `loading="eager"` pero no `fetchpriority="high"`.
- El chunk de la ruta del detalle (lazy) se pide **después** del clic.
- **Corrección (descubierta al implementar):** la carga directa por SSR **sí** repetía la petición a la API. El transfer cache de Angular nunca funcionó en este proyecto: el interceptor `apiOriginInterceptor` corre *antes* del transfer cache, que guardaba la URL absoluta del BFF en el servidor y buscaba la relativa en el navegador (claves distintas). Ver §6.7.
- El service worker usa `freshness` (red primero) para `/api/pokemon/**`: no acelera las visitas repetidas.
- `Cache-Control: public, max-age=300`; TTL del detalle en el BFF: 1 h.
- `PokeApiClient.get` **no cachea** `species`/`chain` (payloads grandes) y no deduplica llamadas simultáneas sin caché.
- `namedLabel` cachea 24 h el **JSON completo** de `/type/x`, `/ability/x`, `/item/x` (decenas de KB) solo para leer dos nombres; `fetchIndex` descarga los mismos `/type/x` y `/generation/x` otra vez sin aprovecharlos.
- `/api/pokemon/25` y `/api/pokemon/pikachu` son dos entradas de caché distintas del mismo dato.

## 3. Requisitos

### 3.1 Funcionales (RD = requisito del detalle)

| Id | Requisito |
|---|---|
| RD-1 | `GET /api/pokemon/:name` devuelve el **núcleo** (sin cadena evolutiva) y `GET /api/pokemon/:name/evolution` devuelve la cadena; ambos se piden en paralelo. |
| RD-2 | El núcleo depende de **una sola etapa** de PokéAPI (`pokemon` ∥ `species`). |
| RD-3 | Un nombre o número del índice se resuelve a `{name, species}` sin llamadas: `25` y `pikachu` comparten caché. |
| RD-4 | Las etiquetas (tipo, generación, estadística, habilidad, objeto) se cachean como `Labels` (unos bytes), no como JSON completo, y las de tipos y generaciones se **siembran** desde el índice. |
| RD-5 | El BFF se calienta al arrancar (índice, etiquetas de estadísticas, conexión a PokéAPI) sin bloquear el arranque ni `/api/health`. |
| RD-6 | Detalle y evolución se sirven **obsoletos mientras se refrescan** (stale-while-revalidate) y, si PokéAPI falla, se sirve el último valor conocido (stale-if-error). |
| RD-7 | Al hacer clic en una tarjeta, el hero se pinta **al instante** con lo conocido (número, nombre, miniatura, tipos); el resto muestra sus skeletons. |
| RD-8 | Con el cursor sobre una tarjeta (≥ 150 ms), foco por teclado o `touchstart`, se **precarga** el núcleo del detalle (no la evolución). |
| RD-9 | El panel de evolución carga y falla de forma **independiente** (skeleton propio, error con «Reintentar»). |
| RD-10 | El servidor web comprime HTML, JS, CSS y JSON; el service worker sirve el detalle con caché primero. |
| RD-11 | La imagen del hero muestra la miniatura mientras llega el artwork y se pide con prioridad alta. |

### 3.2 No funcionales: presupuestos

| Id | Presupuesto | Cómo se verifica |
|---|---|---|
| RNF-D1 | Núcleo en frío con etiquetas cacheadas: **≤ 2 llamadas, 1 etapa** (antes 3 en 3 etapas) | Test determinista con cliente falso y latencia virtual: tiempo virtual = 1 RTT |
| RNF-D2 | Núcleo en frío con habilidades sin cachear, tras el calentamiento: **≤ 5 llamadas** (pokemon, species, ≤ 3 habilidades) y **≤ 2 etapas** (las habilidades se conocen al llegar `pokemon`) | Ídem |
| RNF-D3 | Evolución en frío: **≤ 3 etapas**; nunca bloquea el núcleo | Ídem |
| RNF-D4 | BFF con caché caliente: **≤ 5 ms** por detalle | Benchmark del servicio |
| RNF-D5 | Núcleo en frío de extremo a extremo (conexión abierta): **≤ 400 ms** de mediana en 5 pokémon (antes 380–1.300 ms) | Script de perfilado + tabla antes/después |
| RNF-D6 | Clic → título visible **≤ 100 ms** aunque el BFF tarde 1,5 s | E2E con ruta retrasada (tolerancia 300 ms en CI) |
| RNF-D7 | Detalle ya visto o precargado: **0 peticiones** al abrirlo | Test del gateway + E2E con contador |
| RNF-D8 | Compresión: HTML **≥ 70 %** y JS **≥ 60 %** menos bytes | Medición con `curl` y test de cabeceras |
| RNF-D9 | Precarga acotada: **≤ 2 en vuelo**, **≤ 1 por Pokémon**, **0 con `saveData`** | Test del gateway |
| RNF-D10 | Resultados con PokéAPI caída: detalle visto antes sigue disponible (obsoleto) | Test del servicio con fuente que falla |

> Los tiempos de CI son ruidosos. Las **puertas de regresión** son los tests deterministas (D1–D3, D7, D9, D10); D4–D6 y D8 se miden y se registran.

## 4. Visión general

```
clic en tarjeta ─▶ NavigationHint (resumen) ─▶ hero parcial al instante
        │ (hover/focus/touch ≥150 ms: precarga del núcleo)
        ▼
 CachedPokemonGateway ──┬─ detail(name)     ─▶ GET /api/pokemon/:name            ┐ en paralelo
   (LRU + dedupe)       └─ evolution(name)  ─▶ GET /api/pokemon/:name/evolution  ┘ (solo en el navegador)
                                                      │
 BFF: índice → {name, species} (sin llamadas) ─▶ pokemon ∥ species ─▶ núcleo   (1 etapa)
                                              └▶ species ─▶ chain ─▶ items      (evolución)
 caché: etiquetas como `Labels` (sembradas por el índice) · detalle SWR 24 h / obsoleto 7 d
```

## 5. Diseño del backend

### 5.1 Resolución desde el índice (RD-3)
- `IndexEntry` gana `species: string | null` (nombre de la especie). Se calcula con la misma regla de prefijo más largo que ya usa `generationOf` contra las especies de las generaciones (datos que `fetchIndex` ya descarga): **0 llamadas nuevas**.
- `PokemonService.detail(nameOrId)` resuelve la entrada del índice (nombre o id → entrada). Si existe, la clave de caché es `pokemon:detail:{lang}:{name}` (canónica: `25` y `pikachu` comparten) y pasa `speciesHint` al puerto. Si no existe (p. ej. un Pokémon nuevo con el índice aún vigente) se usa el camino actual (secuencial) y no se rompe nada.
- Puerto: `fetchDetail(nameOrId, lang, speciesHint?)` y nuevo `fetchEvolution(nameOrId, lang, speciesHint?)`.

### 5.2 Núcleo en una etapa (RD-2)
```
con hint:  [ /pokemon/{name} , /pokemon-species/{species} ]   → etiquetas (caché) → núcleo
sin hint:  /pokemon/{name} → /pokemon-species/{url}            (respaldo)
```
Las etiquetas de tipo, generación y estadísticas salen de la caché (§5.3); las habilidades se piden en paralelo solo si faltan.

### 5.3 Etiquetas baratas y sembradas (RD-4, RD-5)
- Nueva operación `Memoizer.put(key, value, ttlMs)` (sembrar sin cargar).
- `namedLabel` deja de cachear el JSON entero: cachea solo `Labels` (`{es, en}`) bajo `label:{resource}:{name}` (24 h) y la carga reutiliza `labelsOf`.
- `fetchIndex` **siembra** `label:type:*` y `label:generation:*` con los datos que ya descarga (hoy los descarta). Resultado: tipos y generaciones del detalle cuestan 0 llamadas siempre.
- Calentamiento (RD-5): `onApplicationBootstrap` lanza sin `await` (con captura de errores y log) `index()` y las 6 etiquetas de estadísticas. Esto abre las conexiones a PokéAPI (≈400 ms que hoy paga el primer visitante) y absorbe BE-002.
- Menos memoria/Redis: de decenas de KB por etiqueta a ≈100 B.

### 5.4 Evolución en su propio endpoint (RD-1, RD-9)
- `GET /api/pokemon/:name/evolution` → `EvolutionNode` (404 si el Pokémon no existe). Ruta antes de `:name` en el controlador no es necesaria (distinta profundidad), pero se documenta en OpenAPI.
- Camino: `species` → `chain` → etiquetas de objetos/lugares (las condiciones de evolución), con el cliente deduplicando `species`/`chain` en vuelo (§5.5) para no pedir lo mismo que el núcleo.
- Caché `pokemon:evolution:{lang}:{name}` con las mismas reglas SWR que el núcleo.

### 5.5 Cliente HTTP: deduplicación en vuelo
`PokeApiClient.get` sin `cacheTtlMs` comparte una sola petición por URL mientras esté en vuelo (`Map<string, Promise>` que se vacía al terminar). No guarda el resultado (los payloads de `species`/`chain` siguen sin cachearse).

### 5.6 Frescura: stale-while-revalidate y stale-if-error (RD-6)
- `Memoizer.remember(key, ttlMs, load, { staleMs })`. Se guarda `{v, at}` con vida física `staleMs`:
  - `edad < ttlMs` → acierto;
  - `ttlMs ≤ edad < staleMs` → devuelve el valor guardado **y** refresca en segundo plano (una sola carga en vuelo por clave);
  - si la carga falla y hay valor guardado → se devuelve ese (stale-if-error); sin valor, el error actual (502).
- Sin `staleMs` el comportamiento actual no cambia (el índice, las etiquetas y la búsqueda no se tocan).
- Configuración: `CACHE_DETAIL_TTL_MS` por defecto **24 h** (antes 1 h) y nuevo `CACHE_DETAIL_STALE_MS` por defecto **7 d**.
- `Cache-Control` del detalle y la evolución: `public, max-age=3600, stale-while-revalidate=86400` (el catálogo conserva `max-age=300`). El ETag débil de Express ya permite 304.

### 5.7 Contrato (`packages/contracts`) — cambio **no aditivo**
```ts
export interface PokemonDetail {
  /* …sin cambios… */
  /** Miniatura (sprite de 96 px) para mostrar mientras llega el artwork. */
  thumbUrl: string;
  // evolution: EvolutionNode   ← eliminado; ahora GET …/:name/evolution
}
```
`pokemon.dto.ts` replica el cambio y añade el endpoint a OpenAPI. `PokemonGateway` gana `evolution(name)`. El BFF y el web se despliegan juntos (monorepo), por lo que no hay clientes antiguos.

## 6. Diseño del frontend

### 6.1 Compresión y service worker (RD-10)
- `server.ts`: middleware `compression` (gzip y brotli) **antes** del proxy `/api` y de los estáticos; umbral 1 KB. El proxy ya elimina `content-encoding` de la respuesta del BFF y no pide compresión hacia arriba, así que no hay doble compresión. Dependencia nueva: `compression` (≥ 1.8, con brotli) en `apps/web`.
- `ngsw-config.json`: nuevo `dataGroup` `detail` (`/api/pokemon/*`, `/api/pokemon/*/evolution`) con `strategy: "performance"`, `maxAge: "1h"`, `maxSize: 100`; el grupo del catálogo y de filtros queda con `freshness`. Se verifica que los patrones no captan `/api/pokemon?…`.
- `app.config.ts`: `withPreloading(PreloadAllModules)` (3 rutas lazy diminutas) para quitar la ida y vuelta del chunk tras el clic.

### 6.2 Gateway: caché y precarga (RD-7/8, RNF-D7/D9)
- `CachedPokemonGateway` cachea también `detail` y `evolution` (LRU de 20, TTL 5 min; misma deduplicación en vuelo y errores no guardados) y expone `prefetch(name)`:
  - ≤ **2** precargas simultáneas (cola FIFO), ≤ **1** por Pokémon (si ya está en caché o en vuelo, no hace nada);
  - no precarga si `navigator.connection?.saveData` es verdadero;
  - precarga solo el **núcleo**; la evolución se pide al llegar a la página.
- `PokemonGateway` gana `prefetchDetail(name): void` (puerto) y `evolution(name)`. El adaptador HTTP no precarga (no-op en el puerto base con implementación vacía en `HttpPokemonGateway`).

### 6.3 Navegación optimista (RD-7)
- `NavigationHint` (servicio en `core/`, junto a `CatalogMemory`): `signal<PokemonSummary | null>`.
- `pokemon-card` emite `selected` en el clic; la página del catálogo guarda el resumen en `NavigationHint`. La página del detalle lo lee al crearse (solo si coincide con `:name`) y lo borra.
- `pokemon-hero` acepta `summary` opcional: sin `pokemon` y con `summary`, pinta número, nombre, tipos y la miniatura escalada; la categoría y las marcas quedan como skeleton. La carga directa (SSR) no usa el resumen: ya llega completa.

### 6.4 Detalle: núcleo y evolución independientes (RD-1/9)
- La página mantiene dos estados (`core`, `evolution`) con `switchMap` y `retry` propios. La evolución se pide **solo en el navegador** (`isPlatformBrowser`): el SSR espera solo el núcleo (TTFB) y el HTML trae el skeleton de evolución, idéntico en servidor y cliente (hidratación estable).
- `evolution-panel`: `root` opcional (skeleton), `failed` y `retry` (error con «Reintentar» dentro del panel, `role="alert"`). `hero`, `about` y `stats` solo dependen del núcleo.
- 404: lo decide el núcleo (como hoy: `RESPONSE_INIT` en SSR).

### 6.7 Transfer cache real (hallazgo)
La reescritura de `/api/…` a la URL interna del BFF se mueve del interceptor `apiOriginInterceptor` a un `HttpBackend` (`apiOriginBackend`, solo en `app.config.server.ts`, envolviendo a `FetchBackend`). El backend va por debajo de todos los interceptores —incluido el transfer cache—, así servidor y navegador usan la misma URL relativa como clave y la hidratación reutiliza las respuestas: la carga directa del detalle ya no repite el núcleo (solo pide la evolución) y la del catálogo no pide nada. Beneficia a todas las páginas, no solo al detalle.

### 6.5 Imagen del hero (RD-11)
- `pokemon-image` gana `placeholder` (URL): mientras el `<img>` principal no carga, se muestra la miniatura detrás, escalada con `image-rendering: pixelated`; al cargar, el principal hace fundido. Sin cambios de tamaño (el espacio ya está reservado).
- Con `eager`, el `<img>` lleva `fetchpriority="high"`.
- El hero usa `thumbUrl` (del núcleo) o `summary.imageUrl` (de la navegación optimista) como `placeholder`.

### 6.8 Precarga de las evoluciones (FE-013)

Objetivo: abrir una etapa de la cadena desde la ficha no espera a la red ni deja marcadores.

- **Qué:** con la evolución cargada (solo navegador), la página pide en reposo (`requestIdleCallback`) el detalle de las etapas más cercanas a la actual, sin ella (`shared/evolution-targets.ts`: padre e hijos primero, máximo `MAX_EVOLUTION_PREFETCH` = 4). El resto se pide al pasar el cursor o el foco por la etapa (150 ms) o al tocarla (`intent` de `evolution-stage`, mismo patrón que la tarjeta).
- **Claves:** las etapas enlazan por **id**, así que se precarga por id (`/api/pokemon/26`), la misma clave que usará la navegación.
- **Evolución sin red:** `CachedPokemonGateway` siembra el árbol cargado bajo el id y el nombre de cada etapa; abrir otra etapa no pide `/evolution` ni muestra el marcador.
- **Artwork:** al llegar un detalle precargado se baja su imagen principal (`new Image()`), así el hero no salta cuando llega.
- **Límites:** la cola existente (≤ 2 en vuelo, 1 por Pokémon, nada con `saveData`); caché de detalle 20 → 30 entradas. El BFF no cambia (su caché ya responde en ≈4 µs).
- **No se hace:** calentar desde el BFF (gasta PokéAPI sin que nadie navegue), endpoint de familia (otro contrato para ahorrar RTT ya paralelos) ni cabecera optimista desde la etapa (no trae tipos ni número).
- **Pruebas:** unitarias de orden/tope, siembra, artwork, intención de etapa y de la página (reposo, SSR sin precarga); E2E: tras cargar Pikachu se piden 172 y 26 solos y abrir Raichu no genera ninguna petición ni marcador.

## 7. Rendimiento: garantías y medición

| Palanca | Efecto esperado | Garantía |
|---|---|---|
| Resolución desde el índice + `pokemon ∥ species` | núcleo en 1 etapa (−150 a −300 ms) | RNF-D1/D2 (determinista) |
| Etiquetas como `Labels` + siembra desde el índice | 0 llamadas de tipo/generación; Redis mucho más pequeño | RNF-D2 |
| Calentamiento al arrancar | quita ≈400 ms del primer visitante | RNF-D5 (medición) |
| Evolución en su endpoint | el núcleo no espera a `chain` ni a los objetos | RNF-D3 |
| SWR 24 h / 7 d + stale-if-error | casi todos ven el camino de 3 ms; sobrevive a una caída de PokéAPI | RNF-D4/D10 |
| Hero optimista + precarga + caché del cliente | título en ≈0 ms; abrir lo ya visto sin red | RNF-D6/D7 |
| Compresión + SW `performance` + preload de chunk | −79 % HTML, −63 % JS; visitas repetidas sin red | RNF-D8 |

**Cómo medir antes/después:**
1. `apps/bff/test/profile-detail.mts` (herramienta de desarrollo, se ejecuta con `npx tsx`): reproduce el perfilado llamada por llamada con el `fetch` real (la línea base de §2 sale de ahí); se ejecuta **antes** de cambiar nada y se anota en BE-007.
2. Test determinista con cliente falso y latencia virtual (`vi.useFakeTimers`): cuenta llamadas y tiempo virtual por escenario (frío con/sin etiquetas, evolución, forma `pikachu-gmax`, número).
3. E2E: clic → título con el BFF retrasado 1,5 s; contador de peticiones al reabrir un Pokémon; cabeceras `content-encoding`.
4. Chromium real con CPU 4× y red lenta: LCP del detalle antes/después (decide F7 en §13).

## 8. Accesibilidad e i18n
- El hero parcial conserva el `h1` y los textos; los marcadores siguen `aria-hidden`. La región `role="status"` de «Cargando…» se mantiene en la página mientras falte el núcleo.
- El error de evolución usa `role="alert"` dentro del panel; «Reintentar» es un `<button appButton>`.
- Texto nuevo: `@@detail.evolution.error` (i18n es/en; `npm run i18n -w apps/web` + `scripts/translate-en.py`); «Reintentar» reutiliza `@@common.retry`.
- axe WCAG 2.1 AA sin violaciones, incluido el estado intermedio (hero parcial).

## 9. Pruebas

| Nivel | Casos |
|---|---|
| BFF unitarias | resolución por nombre/número/forma desde el índice; clave canónica compartida; núcleo en 1 etapa y ≤ 2 llamadas (latencia virtual); respaldo secuencial sin índice; evolución en ≤ 3 etapas y sin bloquear el núcleo; etiquetas sembradas (0 llamadas de tipo/generación); `Memoizer.put`; SWR (acierto, obsoleto → refresco único, stale-if-error, sin `staleMs` = comportamiento actual); deduplicación en vuelo del cliente |
| BFF e2e (controlador) | `GET …/:name` sin `evolution` y con `thumbUrl`; `GET …/:name/evolution`; 404 en ambos; `Cache-Control` del detalle; `Vary`; 304 |
| BFF arranque | el calentamiento no bloquea `/api/health` y tolera errores |
| Web unitarias | gateway: caché de `detail`/`evolution`, LRU, TTL, dedupe, errores, `prefetch` (≤ 2 en vuelo, ≤ 1 por Pokémon, `saveData`); `NavigationHint`; hero parcial; `pokemon-image` con placeholder y `fetchpriority`; `evolution-panel` (skeleton, error, reintento); página (núcleo y evolución independientes, solo navegador para la evolución, 404 desde el núcleo); `pokemon-card` (`selected`, intención con temporizador) |
| Web configuración | `ngsw-config.json`: el grupo `detail` no capta `/api/pokemon?…` |
| E2E (Playwright, PokéAPI real) | clic → título ≤ 300 ms con BFF retrasado; reabrir sin petición; prefetch al pasar el cursor; evolución con skeleton y error recuperable; `content-encoding` en HTML y JS; carga directa con evolución diferida; axe del estado intermedio |

## 10. Plan de implementación

| Fase | Contenido | Criterio de salida |
|---|---|---|
| 0 | Perfilado y test determinista sobre el código actual; anotar la línea base en BE-007 | números registrados; el test de 1 etapa **falla** |
| 1 | `Memoizer.put` + SWR/stale-if-error; etiquetas como `Labels` y siembra desde el índice; deduplicación en vuelo; calentamiento; TTL/`Cache-Control` | tests BFF; RNF-D2/D4/D10 |
| 2 | `IndexEntry.species`, resolución desde el índice, `pokemon ∥ species` | RNF-D1 |
| 3 | Contrato (`thumbUrl`, sin `evolution`), endpoint de evolución, puerto, DTOs, OpenAPI | RNF-D3; e2e del controlador |
| 4 | Web: compresión, `ngsw-config`, precarga de rutas | RNF-D8 |
| 5 | Web: gateway (`detail`/`evolution`/`prefetch`), núcleo y evolución independientes, panel de evolución con error | RNF-D7/D9 |
| 6 | Web: `NavigationHint`, hero parcial, `pokemon-image` (placeholder, `fetchpriority`), intención en la tarjeta | RNF-D6 |
| 7 | i18n, accesibilidad, E2E, medición final vs. línea base, actualizar SDD §5–§7, README y documentos de mejoras | `npm run lint`, `npm test`, `npm run build && npm run e2e`; tabla antes/después |

Las fases 1–2 son valiosas por sí solas (reducen el piso del BFF sin tocar el contrato); la 3 es el único cambio no aditivo.

## 11. Decisiones y riesgos

| Id | Decisión | Elegida | Alternativa |
|---|---|---|---|
| D1 | Dividir núcleo y evolución (contrato no aditivo) | **Sí**, en la fase 3 | Mantener un solo endpoint |
| D2 | Precarga por intención | **Sí**, con límites (≤ 2 en vuelo, `saveData`, solo núcleo) | Sin precarga |
| D3 | Frescura del detalle | **SWR**: 24 h frescas, 7 d obsoletas | 1 h sin SWR |
| D4 | Endpoint de imágenes con redimensionado | **No** por ahora (decide §13) | Añadirlo con `sharp` |
| D5 | Evolución solo en el navegador | **Sí** (el SSR responde con el núcleo) | SSR espera ambas |
| D6 | Estado de navegación optimista | `NavigationHint` (servicio) | Estado del router (`history.state`) |
| D7 | Compresión | Paquete `compression` | Código propio con `zlib` |

| Riesgo | Mitigación |
|---|---|
| Cambio de contrato rompe pantallas o tests | Fase 3 aislada; tests y OpenAPI actualizados; monorepo se despliega junto |
| La precarga aumenta la carga hacia PokéAPI | Núcleo solo (≤ 5 llamadas), ≤ 2 en vuelo, `saveData`, caché compartida del BFF |
| Datos obsoletos hasta 7 d | PokéAPI casi no cambia; SWR refresca en segundo plano tras 24 h |
| `put`/SWR con Redis: formato `{v, at}` distinto del actual | Clave nueva por prefijo de versión (`v2:`); los valores viejos expiran solos |
| Sembrar etiquetas desde el índice acopla dos funciones | Vive en `pokeapi.source.ts` (único lugar que conoce PokéAPI) |
| La evolución solo en cliente deja el skeleton en el HTML del SSR | Es el mismo marcado en servidor y cliente (hidratación estable); no afecta al contenido principal |
| El hero parcial se desfasa del real | Test de estructura/alturas y E2E con axe del estado intermedio |

## 12. Trazabilidad con el análisis

| Elemento del análisis | Sección |
|---|---|
| B1 `pokemon ∥ species` | §5.1 · §5.2 · RD-2 |
| B2 etiquetas del índice y calentamiento de estadísticas | §5.3 · RD-4/5 |
| B3 calentar la conexión | §5.3 (calentamiento) |
| B4 TTL 24 h + refresco en segundo plano | §5.6 · RD-6 |
| B5 dividir núcleo y evolución | §5.4 · §5.7 · §6.4 |
| B6 compresión | §6.1 |
| F1 compresión del servidor web | §6.1 · RD-10 |
| F2 navegación optimista | §6.3 · RD-7 |
| F3 precarga por intención | §6.2 · RD-8 |
| F4 precarga del chunk | §6.1 |
| F5 imagen del hero | §6.5 · RD-11 |
| F6 service worker `performance` | §6.1 |
| F7 proxy de imágenes | D4 · §13 |
| Hallazgos nuevos: cache de JSON completo en etiquetas, doble entrada `25`/`pikachu`, resolución desde el índice | §5.1 · §5.3 |

## 13. Resultados (implementación)

### BFF — PokéAPI real (`npx tsx test/profile-detail.mts`, 2 corridas × 5 Pokémon, conexión ya abierta)
| | Antes | Después |
|---|---|---|
| Núcleo con etiquetas cacheadas (3 llamadas, 3 etapas) | 380–600 ms | **240–320 ms** en 9 de 10 medidas (mediana ≈ 275 ms; una medida atípica de 605 ms por la propia PokéAPI); 2–5 llamadas, 1–2 etapas |
| Detalle completo en frío (Eevee: 19 llamadas, 4 etapas) | 1.295 ms | núcleo **259–287 ms** (5 llamadas) y evolución 386–403 ms, **en paralelo** |
| Detalle completo en frío (Charizard) | 760 ms | núcleo **242–319 ms** y evolución 237–318 ms, en paralelo |
| Llamadas del primer detalle tras arrancar | 14–19 | **5** (pokemon, species, 2–3 habilidades; tipos, generación y estadísticas ya están sembrados o calentados) |
| Detalle con caché caliente | 3 ms | **≈ 4 µs** en el servicio (benchmark) |

El escenario A de la herramienta (sin pista ni calentamiento: 13 llamadas, ≈ 400 ms) ya incluye la conexión abierta del propio proceso, por lo que no es comparable con los 760–1.295 ms de la línea base, que incluían ≈ 400 ms de DNS + TLS; el calentamiento al arrancar (RD-5) mueve ese coste fuera de la primera petición.

**En Docker** (stack Compose, PokéAPI real, medido con `curl` a través del servidor web, tras «Calentamiento listo»): núcleo en frío **0,54–0,59 s** (Dragonite, Mewtwo) y 0,27 s la evolución; repetido 8–13 ms. La red del contenedor hacia PokéAPI es más lenta que la del anfitrión, por eso las cifras absolutas son mayores; la línea base en el mismo entorno era 0,91–1,78 s (Bulbasaur, Charizard, Eevee).

### Presupuestos
| Id | Resultado |
|---|---|
| RNF-D1 | **Cumplido** (test determinista: 2 llamadas, 1 etapa con etiquetas en caché; antes 3 llamadas y 3 etapas) |
| RNF-D2 | **Cumplido** (≤ 5 llamadas, 2 etapas) |
| RNF-D3 | **Cumplido** (evolución ≤ 3 etapas; 2 con etiquetas en caché) y no bloquea el núcleo |
| RNF-D4 | **Cumplido**: ≈ 4 µs en el servicio |
| RNF-D5 | **Cumplido**: mediana ≈ 275 ms (< 400 ms) |
| RNF-D6 | **Cumplido**: clic → título **76–105 ms** con el BFF retrasado 1,5 s (E2E: < 600 ms de tolerancia) |
| RNF-D7 | **Cumplido** (tests y E2E: 0 peticiones al reabrir un Pokémon visto) |
| RNF-D8 | **Cumplido**: `content-encoding: gzip` en HTML, JS y CSS (E2E); la reducción medida de §2 fue −79 % (HTML) y −63 % (JS) |
| RNF-D9 | **Cumplido** (test: ≤ 2 en vuelo, 1 por Pokémon, 0 con `saveData`) |
| RNF-D10 | **Cumplido** (SWR y stale-if-error en `memoizer.spec.ts`) |

### Navegador (Chromium, PokéAPI real)
- Clic → ficha completa con el BFF en frío: 358 ms (Mewtwo) y 870 ms (Mew); el título aparece a los 76–83 ms en ambos casos.
- LCP del detalle con CPU 4× más lenta y 4G lento (latencia 150 ms, 1,6 Mbps): **1,7–1,9 s** (< 2,5 s, «bueno»). Con ese margen **D4 queda cerrada: no se añade proxy de imágenes**.
- Carga directa del detalle: 1 petición (evolución, en el navegador) frente a 3 antes; catálogo: 0 frente a 2.

### Desviaciones respecto al diseño
- Hallazgo y corrección del transfer cache (§6.7): no estaba en el diseño y es la mejora transversal más amplia.
- RNF-D2 pasó de «1 etapa» a «≤ 2 etapas»: las habilidades solo se conocen al llegar `pokemon`.
- Un solo texto i18n nuevo (`@@detail.evolution.error`) en vez de dos.
- `NavigationHint` se alimenta desde la página del catálogo (que ya inyecta servicios) con la salida `selected` de la tarjeta; `Enter` también la emite porque `RouterLink` lo gestiona sin evento `click`.
- El E2E de «selector de idioma» y el de «Escape» esperan a que la página esté hidratada o actualizada antes de actuar: sin esa espera eran carreras del propio test.
- No se probó el catálogo con Redis activo tras este cambio (el detalle conserva el formato `{v, at}` bajo claves `v2:`).

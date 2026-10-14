# SDD · Mejora definitiva del buscador (frontend + backend)

> **Estado:** **implementado y verificado** · versión 1.1 · 2026-10-13 (resultados reales en §13)
> **Documento base:** [`SDD.md`](SDD.md) (§5 contratos, §6 BFF, §7 web). Este documento **extiende** el SDD; al implementarse, sus cambios se vuelcan al SDD base.
> **Seguimiento:** [BE-006](mejoras/BACKEND.md) y [FE-010](mejoras/FRONTEND.md).
> **Relacionado:** [BE-001](mejoras/BACKEND.md) (nombres localizados), [BE-002](mejoras/BACKEND.md) (calentamiento del índice).

---

## 1. Objetivo y alcance

Hacer que la búsqueda por nombre del catálogo sea **más relevante, más rápida y más robusta**, con **presupuestos de rendimiento medibles** y guardas que impidan regresiones.

| Dentro | Fuera |
|---|---|
| Relevancia y orden de resultados, búsqueda por número, tolerancia a erratas, normalización | Motores externos (Elasticsearch, Meilisearch) y librerías de búsqueda difusa: no se justifican con ~1.350 nombres |
| Índice de búsqueda precalculado en el BFF | Índice completo en el navegador (rompería "el BFF filtra") |
| Caché, deduplicación y experiencia de escritura en el web | Autocompletado con desplegable (otro patrón de accesibilidad; mejora aparte) |
| Validación, contrato, pruebas y presupuestos | Búsqueda por nombre localizado (ver §11, decisión D2) |

## 2. Estado actual y problemas (evidencia)

Fuentes: `pokemon.service.ts`, `catalog-filters.ts`, `search-field.ts`, `catalog.ts`, `http-pokemon-gateway.ts`, `ngsw-config.json`.

| # | Problema | Dónde | Impacto |
|---|---|---|---|
| P1 | Cada petición normaliza los ~1.350 nombres (`normalizeSearch(entry.name)` dentro del `filter`) | BFF | ≈306 µs/petición frente a ≈18 µs con la clave precalculada (benchmark Node, 1.350 entradas sintéticas): 17× |
| P2 | Sin orden de relevancia: se ordena por id. `char` lista antes cualquier nombre que contenga "char" que "Charmander" | BFF | Mayor problema de calidad |
| P3 | Un `q` que solo trae símbolos (`!!!`) se normaliza a `''` y **devuelve todo el catálogo** (`!needle` es verdadero) | BFF | Resultado incorrecto |
| P4 | No se busca por número (`25`, `#025`), aunque el detalle sí lo acepta | BFF | Funcionalidad ausente |
| P5 | Sin tolerancia a erratas (`pikchu`) | BFF | Búsqueda sin resultados evitable |
| P6 | Al escribir, el catálogo pasa a esqueleto completo en cada consulta | Web | Parpadeo, salto de layout |
| P7 | Sin deduplicación ni caché propia de consultas: reescribir o volver atrás repite la petición | Web | Latencia y carga innecesarias |
| P8 | Una tecla suelta (1 carácter) lanza una búsqueda que devuelve cientos de resultados y puebla la caché del service worker (200 entradas) | Web | Ruido y desperdicio |
| P9 | `maxLength = 50` duplicado en componente, `catalog-params.ts` y DTO | Ambos | Riesgo de desincronización |
| P10 | La página no distingue "búsqueda exacta" de "aproximada" | Web | Falta de transparencia |

Hechos que **limitan** las mejoras (para no prometer de más):
- `Cache-Control: public, max-age=300` ya hace que el navegador reutilice respuestas idénticas durante 5 min; la caché del cliente (§6.2) aporta determinismo, no un salto de órdenes de magnitud.
- El filtrado en sí ya es barato (µs); el cuello de botella real es la **latencia de red + el re-render**, por eso el web pesa tanto como el BFF en este diseño.
- `packages/contracts` es **solo tipos** (no puede exportar funciones ni constantes en runtime: Nest compila a ESM sin resolver `.ts`). Las constantes y la normalización se duplican y se sincronizan con un test de paridad (§9).

## 3. Requisitos

### 3.1 Funcionales (RB = requisito de búsqueda)

| Id | Requisito |
|---|---|
| RB-1 | La consulta se normaliza: minúsculas, sin acentos, separadores (`-`, `.`, `'`, espacios repetidos) reducidos a un espacio. `Mr. Mime` ≡ `mr-mime` ≡ `MR MIME`. |
| RB-2 | Los resultados se ordenan por **relevancia** (§5.3); a igual relevancia, por id. Sin texto, el orden por id no cambia. |
| RB-3 | Una consulta numérica (`25`, `#25`, `025`) coloca primero el Pokémon con ese id. |
| RB-4 | Varias palabras: `mime mr` y `tapu ko` encuentran sus nombres (cada palabra debe ser prefijo de alguna palabra del nombre). |
| RB-5 | Si no hay ninguna coincidencia y la consulta tiene ≥ 4 caracteres, se devuelven nombres **parecidos** (distancia de edición ≤ 1, con transposición) y la respuesta lo indica (`fuzzy: true`). |
| RB-6 | Una consulta no vacía que se normaliza a `''` devuelve **0 resultados**, nunca el catálogo completo. |
| RB-7 | La búsqueda se combina con tipo y generación (comportamiento actual). |
| RB-8 | El web no busca con 1 carácter (salvo un dígito); vaciar el campo limpia al instante. |
| RB-9 | Durante una nueva consulta se **conservan los resultados anteriores** (atenuados); el esqueleto solo aparece en la primera carga o tras un error. |
| RB-10 | La página informa cuándo los resultados son aproximados. |

### 3.2 No funcionales: presupuestos de rendimiento

| Id | Presupuesto | Cómo se verifica |
|---|---|---|
| RNF-B1 | `PokemonService.list` con búsqueda de texto, en proceso, 1.350 entradas: **p95 ≤ 0,25 ms** (prototipo medido: ≈0,04 ms; margen ≈6×) | Benchmark `vitest bench` (informativo en CI) |
| RNF-B2 | Con recurso difuso (peor caso, 0 coincidencias): **p95 ≤ 1 ms** (prototipo: ≈0,21 ms) | Ídem |
| RNF-B3 | Construcción del índice de búsqueda: **≤ 10 ms, una vez por índice** (no por petición) | Test determinista (§9) |
| RNF-B4 | **Una sola** normalización de la consulta por petición y **cero** normalizaciones de nombres por petición | Test determinista con contador (no depende del reloj) |
| RNF-F1 | Escribir una palabra seguida (pausas < debounce) → **1 petición**; repetir una consulta ya hecha → **0 peticiones** | Test del gateway con `HttpTestingController` |
| RNF-F2 | Sin esqueleto al refinar la búsqueda y **CLS ≤ 0,1** (umbral «bueno»); la grilla permanece en el DOM con `aria-busy` | E2E + medición en Chromium |
| RNF-F3 | Consulta en caché → pintada en **≤ 1 frame** (sin red) | Test unitario + E2E |
| RNF-F4 | Teclas descartadas (1 carácter): **0 peticiones y 0 entradas nuevas** en el service worker | E2E con contador de peticiones |

> Los presupuestos B1/B2 son tiempos en proceso; los tiempos en CI son ruidosos, por eso la **puerta de regresión** son los tests deterministas (RNF-B3/B4, F1) y el benchmark es de vigilancia.

## 4. Visión general

```
campo ─(texto)─▶ catalog-filters ─(q normalizado, ≥2, debounce 250 ms)─▶ página (URL ?q=)
                                                                              │
                          CachedPokemonGateway (LRU + dedupe) ◀───────────────┘
                                   │ miss
                                   ▼
                       HttpPokemonGateway ──GET /api/pokemon?q=…──▶ BFF
                                                                     │
                       SearchIndex (claves precalculadas, 1 vez) ◀───┘
                       parseQuery → rank → (fuzzy si 0) → paginar
```

## 5. Diseño del backend

### 5.1 Índice de búsqueda precalculado
- Nuevo tipo interno (application, no se expone) `SearchEntry { id, name, key, words, types, generation }`, con `key = normalizeSearch(name)` y `words = key.split(' ')`.
- Se construye **una vez por índice** a partir de `PokemonIndex` y se guarda junto a él (`WeakMap<PokemonIndex, SearchEntry[]>` o, si el almacén de caché devuelve copias, dentro del mismo `Memoizer` bajo la clave `pokemon:search-index` con el TTL del índice). **Riesgo a verificar en la fase 1:** si Redis/`cacheable` deserializa el índice y cambia la identidad del objeto, la `WeakMap` reconstruiría en cada petición; el test de RNF-B3 lo detecta (cuenta de construcciones = 1).
- El mapa de etiquetas de tipo por idioma (`labelOfType`) se calcula una vez por (índice, idioma), no por petición.
- No se crean buckets por tipo/generación: con 1.350 entradas el filtrado inline cuesta µs (YAGNI); se reevalúa solo si RNF-B1 se incumple.

### 5.2 Interpretación de la consulta (`parseQuery`)
```
raw ──normalizeSearch──▶ needle
  needle === '' y raw.trim() !== ''  →  sin resultados (RB-6)
  needle === ''                      →  sin filtro de texto
  /^\d{1,4}$/ (tras quitar '#')      →  id = Number(needle) + también coincidencia de texto
  tokens = needle.split(' ')
```

### 5.3 Relevancia (RB-2…RB-4)
Un único recorrido; cada entrada recibe una puntuación (menor = mejor) y se ordena por `(puntuación, id)`:

| Puntuación | Regla | Ejemplo (`q`) |
|---|---|---|
| 0 | `id === número` o `key === needle` | `25` → Pikachu; `eevee` |
| 1 | `key` empieza por `needle` | `char` → Charmander, Charmeleon, Charizard |
| 2 | Todos los tokens son prefijo de alguna palabra de `words` | `mime mr`, `tapu ko` |
| 3 | `key` contiene `needle` (subcadena) | `ika` → Pikachu |

- Las formas alternativas (`pikachu-gmax`, id > 10000) se ordenan por id dentro de su grupo, es decir, después de la forma base. No se filtran (BE-004 sigue pendiente).
- Paginación **después** de ordenar: `total` es el número real de coincidencias; el orden es estable entre páginas.
- Coste: un recorrido O(n) + ordenación de las coincidencias (prototipo: ≈40 µs con 226 coincidencias).

### 5.4 Tolerancia a erratas (RB-5)
- Solo se ejecuta si **0** coincidencias y `needle.length ≥ 4` (con menos, los falsos positivos dominan).
- Coincide si, para alguna palabra `w` del nombre, `distancia(w, needle) ≤ 1` o `distancia(w[0..len(needle)], needle) ≤ 1` (erratas en un prefijo), contando sustitución, inserción, borrado y **transposición adyacente**.
- Implementación con corte temprano (`|len(a) − len(b)| > 1` descarta de inmediato); sin matrices.
- El resultado se marca `fuzzy: true` y se ordena por puntuación 4, luego id.
- Peor caso medido en prototipo: ≈0,21 ms (RNF-B2).

### 5.5 Contrato (`packages/contracts`)
Cambio **aditivo y opcional** (no rompe clientes):
```ts
export interface Page<T> {
  items: T[]; total: number; offset: number; limit: number;
  /** Solo si no hubo coincidencias exactas y se muestran nombres parecidos. */
  fuzzy?: true;
}
```
`pokemon.dto.ts` replica el campo (OpenAPI) y sigue `implements Page<…>`. `CatalogQuery` no cambia.

### 5.6 Validación y robustez
- `q`: `@MaxLength(SEARCH_MAX_LENGTH)` (50) y `@Transform` que recorta (`trim`) y elimina caracteres de control antes de validar. Una consulta con caracteres no ASCII que no se reduzca a nada (p. ej. solo emojis) → RB-6.
- `Vary: Accept-Language`: **ya se emitía** (`reply()` del controlador); solo se añadió un test.
- `ETag`: Express genera ETag débil por defecto; **no se añade código**, se añade un test que confirme `If-None-Match` → `304` y se documenta.
- Respuestas cacheadas en servidor por clave de consulta: **no** (RNF-B1 se cumple con margen). Si una medición futura lo incumple, la alternativa documentada es un LRU de 500 claves `(q,type,generation,offset,limit,lang)`.

## 6. Diseño del frontend

### 6.1 Entrada de texto (`search-field` y `catalog-filters`)
- `normalizeQuery(text)` (utilidad pura en `app/pages/catalog/`, junto a `catalog-params.ts`): NFC, quita caracteres de control, colapsa espacios, `trim`, corta a `SEARCH_MAX_LENGTH`. **No** cambia mayúsculas ni acentos en la URL (se respeta lo que escribió el usuario); la clave de caché sí se canonicaliza (§6.2).
- Regla de emisión en `catalog-filters` (`ui/`, sin servicios):
  | Texto normalizado | Acción |
  |---|---|
  | `''` | emite `''` **de inmediato** (sin debounce) |
  | 1 carácter no numérico | no emite; muestra la pista «Escribe al menos 2 caracteres» (`aria-describedby`) |
  | resto | emite tras **250 ms** de pausa, y solo si difiere del valor vigente (se conserva el `filter` actual) |
  | Enter | emite de inmediato (si cumple la regla de longitud) |
- `Escape` vacía el campo. Atributos: `inputmode="search"`, `enterkeyhint="search"`, `spellcheck="false"`, `autocapitalize="off"`.
- El debounce baja de 300 a 250 ms: con la caché y la conservación de resultados, la latencia percibida mejora sin aumentar la carga (el mínimo de 2 caracteres evita ruido).

### 6.2 `CachedPokemonGateway` (decorador del puerto)
- Implementa `PokemonGateway` envolviendo a `HttpPokemonGateway`; se elige en `app.config.ts` (una línea, como el resto de adaptadores).
- Solo cachea `list` (y no `detail`, que ya tiene `CatalogMemory` y caché HTTP).
- **Clave canónica:** `lang|q'|type|generation|offset|limit`, con `q'` = `q` en minúsculas, sin acentos y con separadores colapsados (misma regla que el BFF). Así `Pika`, `pika ` y `PIKA` comparten entrada.
- **LRU de 30 entradas, TTL 5 min** (alineado con `max-age=300`).
- **Deduplicación en vuelo:** dos suscripciones a la misma clave comparten una petición; un error **no** se guarda.
- La caché se descarta al cambiar de idioma (el idioma forma parte de la clave y la app se recarga por subruta, así que no requiere invalidación explícita).
- Justificación honesta: la caché HTTP del navegador ya cubre repeticiones, pero depende de cabeceras, del service worker y de DevTools; la caché explícita las hace deterministas, funciona igual en SSR/hidratación y permite probar RNF-F1/F3 sin red.

### 6.3 Conservar resultados mientras se busca (RB-9)
- El estado de la página gana un campo: `{ status: 'ready'; page; stale: boolean }`. En `switchMap`, si ya había una página lista, se emite `{ …anterior, stale: true }` en lugar de `LOADING`; el esqueleto queda para la primera carga y los reintentos.
- `pokemon-grid` recibe `[stale]` (atenúa con `opacity` por token y `aria-busy="true"`; sin cambios de layout). El contador cambia a «Buscando…» (`role="status"`, `aria-live="polite"`) y vuelve al total al llegar la respuesta.
- Una respuesta tardía de una consulta anterior no puede pisar a la nueva: ya lo garantiza `switchMap` (se cancela la petición anterior).

### 6.4 Resultados aproximados (RB-10)
- Si `page.fuzzy`, bajo el contador: «Sin coincidencias exactas para «{q}». Mostrando nombres parecidos.» (i18n es/en, `tone="muted"`).
- Estado vacío existente (sin resultados) intacto.

### 6.5 Constantes y paridad
`SEARCH_MAX_LENGTH = 50`, `SEARCH_MIN_LENGTH = 2` y la regla de normalización se **definen una vez por app** (`apps/bff/src/common/text.ts`, `apps/web/src/app/pages/catalog/search-query.ts`) y se verifican con un archivo de casos compartido (§9). El componente `search-field` recibe `maxLength` por input (ya existe), no lo define.

## 7. Rendimiento: garantías y medición

| Palanca | Efecto esperado | Garantía |
|---|---|---|
| Claves precalculadas | −94 % de CPU por petición (306 → ~20 µs en benchmark) | RNF-B3/B4 (tests deterministas) |
| Orden en un solo recorrido | sin coste apreciable (≈40 µs con 226 coincidencias) | RNF-B1 |
| Difuso solo con 0 coincidencias y ≥ 4 caracteres | el caso común no paga nada | RNF-B2 |
| Mínimo de 2 caracteres + debounce 250 ms | menos peticiones; menos entradas del service worker | RNF-F1/F4 |
| Caché LRU + dedupe | 0 peticiones al repetir; 1 por consulta concurrente | RNF-F1/F3 |
| Resultados conservados | sin esqueleto ni salto de layout al refinar | RNF-F2 |
| `ETag`/`304` ya existentes | revalidación sin cuerpo | test de 304 |

**Cómo medir antes/después** (para evidenciar la mejora, no solo afirmarla):
1. `apps/bff/test/search.bench.ts` (`vitest bench`): `list` con 1.350 entradas sintéticas para las consultas `''`, `pi`, `pika`, `mime`, `zzzz`, `pikchu`, `25`; se ejecuta contra la versión actual **antes** de tocar nada y se anota la línea base en BE-006.
2. Contadores deterministas: veces que se llama a `normalizeSearch` por petición; construcciones del índice de búsqueda.
3. E2E: número de peticiones a `/api/pokemon` al escribir `pikachu` pulsando teclas con pausas cortas (esperado: 1) y al repetir la búsqueda (esperado: 0).
4. Chromium real: Performance panel con 4× CPU throttling escribiendo `char`; sin tareas largas (> 50 ms) atribuibles al filtrado/render.

## 8. Accesibilidad e i18n
- El contador sigue siendo la **única** región `role="status"` del catálogo (evitar anuncios duplicados); «Buscando…» y los avisos aproximados usan esa misma región o `aria-describedby`, no una segunda.
- La pista de longitud mínima se asocia con `aria-describedby`.
- Textos nuevos con ids `@@filters.hint`, `@@catalog.searching`, `@@catalog.fuzzy`; actualizar `messages.en.xlf` (`npm run i18n -w apps/web` + `scripts/translate-en.py`).
- axe WCAG 2.1 AA sin violaciones (E2E existentes + caso nuevo con resultados aproximados).

## 9. Estrategia de pruebas

| Nivel | Casos |
|---|---|
| BFF unitarias (`pokemon.service`) | relevancia (exacto > prefijo > palabra > subcadena), orden estable entre páginas, número (`25`, `#025`, `0`, `99999`), multi-palabra, `Mr. Mime`, acentos, solo símbolos → 0 (RB-6), solo espacios → sin filtro, longitud 50 y 51, difuso (`pikchu`, transposición `pikahcu`, < 4 caracteres → sin difuso), `fuzzy` ausente cuando hay coincidencias, combinación con tipo/generación, formas alternativas después de la base |
| BFF deterministas | índice de búsqueda construido 1 vez por índice; 1 normalización de consulta por petición; 0 de nombres |
| BFF e2e (controlador) | `fuzzy` en la respuesta, `q` demasiado largo → 400, `If-None-Match` → 304, `Vary` correcto |
| Web unitarias | `normalizeQuery`; regla de emisión (vacío inmediato, 1 carácter no emite, Enter inmediato, Escape); `CachedPokemonGateway` (clave canónica, LRU, TTL, dedupe, error no cacheado); página (estado `stale`, aviso aproximado) |
| Paridad web ↔ BFF | `packages/contracts/search-fixtures.json` (entrada → clave normalizada) leído por **ambos** conjuntos de tests (el archivo es datos, no código: no rompe la regla de "contracts solo tipos") |
| E2E (Playwright, PokéAPI real) | `char` lista Charmander primero; `25` abre Pikachu primero; `pikchu` muestra aviso aproximado; 1 carácter no dispara petición; refinar no muestra esqueleto; contador de peticiones (RNF-F1) |
| Rendimiento | `vitest bench` (vigilancia) + contadores deterministas (puerta) |

## 10. Plan de implementación

| Fase | Contenido | Criterio de salida |
|---|---|---|
| 0 | Línea base: benchmark + contadores sobre el código actual; anotar números en BE-006 | números registrados |
| 1 | BFF: `SearchEntry`, `parseQuery`, relevancia, número, RB-6, validación y límites | tests BFF en verde; RNF-B3/B4 |
| 2 | BFF: difuso + `fuzzy` en el contrato y el DTO; test 304/`Vary` | RNF-B2; OpenAPI actualizada |
| 3 | Web: `normalizeQuery`, regla de emisión, debounce 250 ms, pista, Escape | tests web; RNF-F4 |
| 4 | Web: `CachedPokemonGateway` y conservación de resultados (`stale`) | RNF-F1/F2/F3 |
| 5 | Aviso aproximado, i18n, accesibilidad, E2E | `npm run lint`, `npm test`, `npm run build && npm run e2e` |
| 6 | Medición final vs. línea base; actualizar SDD §5–§7, README y los documentos de mejoras | tabla antes/después en BE-006/FE-010 |

Orden pensado para que el BFF sea valioso por sí solo desde la fase 2, y el web pueda adoptarlo por partes.

## 11. Decisiones y riesgos

| Id | Decisión | Elegida | Alternativa |
|---|---|---|---|
| D1 | Orden por relevancia | **Sí** (cambia el orden solo cuando hay texto) | Mantener orden por id |
| D2 | Búsqueda por nombre localizado | **No** en esta mejora: exigiría ≈1.350 llamadas extra a PokéAPI al construir el índice. Queda enlazada a **BE-001**; si se aprueba, solo añade `labelKey` por idioma al `SearchEntry` | Aplicar BE-001 junto con esta mejora |
| D3 | Tolerancia a erratas | **Sí**, solo con 0 coincidencias y ≥ 4 caracteres | No tenerla |
| D4 | Mínimo de 2 caracteres | **Sí** (en el web; el BFF sigue aceptando 1) | Sin mínimo |
| D5 | Conservar resultados al buscar | **Sí** | Esqueleto completo |
| D6 | Caché de respuestas en el BFF | **No** (presupuesto cumplido con margen) | LRU de 500 claves |
| D7 | Constantes compartidas | Duplicadas + test de paridad (contracts es solo tipos) | Paquete con runtime (requiere build) |

| Riesgo | Mitigación |
|---|---|
| Identidad del índice cambia con Redis y reconstruye la búsqueda en cada petición | Test de "1 construcción por índice"; plan B: guardar el índice de búsqueda en el `Memoizer` |
| Cambio de orden sorprende a quien conocía el anterior | Solo afecta con texto; documentado en el SDD y el README |
| Difuso devuelve resultados poco útiles | Solo con 0 coincidencias, ≥ 4 caracteres, distancia ≤ 1, y se rotula como aproximado |
| Tiempos de CI ruidosos | La puerta son contadores deterministas; el benchmark es informativo |
| Caché del cliente sirve datos antiguos | TTL 5 min, igual que `max-age`; se descarta al recargar |
| `stale` confunde a lectores de pantalla | Una sola región `role="status"`; `aria-busy` en la grilla; prueba axe |

## 12. Trazabilidad con el análisis

| Elemento del análisis | Sección |
|---|---|
| Índice precalculado | §5.1 · RNF-B3/B4 |
| Relevancia por tipo de coincidencia | §5.3 · RB-2 |
| Búsqueda por número | §5.2/§5.3 · RB-3 |
| Nombre localizado | D2 · BE-001 |
| Tolerancia a erratas | §5.4 · RB-5 |
| `ETag`, caché de servidor | §5.6 · D6 |
| Resultados anteriores atenuados | §6.3 · RB-9 |
| Caché en el cliente | §6.2 · RNF-F1/F3 |
| Normalizar `q` antes de emitir | §6.1 · RB-1 |
| Mínimo de 2 caracteres | §6.1 · RB-8 |
| Debounce | §6.1 |
| Escape / accesibilidad | §6.1 · §8 |
| Constante única de longitud | §6.5 · D7 |
| Tests de contrato y de rendimiento | §9 · §7 |
| Nuevo hallazgo: `!!!` devuelve todo (P3) | RB-6 · §5.2 |

## 13. Resultados (implementación)

**Hallazgo clave de la fase 0:** la línea base de `PokemonService.list` era **≈1,3–1,6 ms incluso con `q=""`**, y el filtrado de nombres era solo ≈0,3 ms. El coste dominante era la caché de memoria: `Keyv` serializaba con JSON en cada lectura y `cacheable` clonaba, de modo que el índice (1.350 entradas) se reconstruía en cada petición **y cambiaba su identidad** (la `WeakMap` del §5.1 habría reconstruido la búsqueda siempre). Se corrigió en `config/cache-store.ts` con `serialization: false` y `useClone: false` (lectura: 1,3 ms → 0,007 ms; mismo objeto).

### BFF (`npm run bench -w apps/bff`, 1.350 entradas sintéticas, caché de producción, Node)

| Consulta | Antes (media) | Después (media) | Mejora |
|---|---|---|---|
| `""` | 1,32 ms | 0,021 ms | ≈63× |
| `pi` | 1,58 ms | 0,040 ms | ≈40× |
| `pika` | 1,60 ms | 0,039 ms | ≈41× |
| `mime` | 1,60 ms | 0,041 ms | ≈39× |
| `zzzz` (sin resultados + difuso evitado por longitud) | 1,60 ms | 0,088 ms | ≈18× |
| `pikchu` (difuso) | 1,60 ms | 0,080 ms | ≈20× |
| `25` | 1,59 ms | 0,044 ms | ≈36× |

Presupuestos: RNF-B1 (≤ 0,25 ms) cumplido con p99 ≈ 0,08 ms; RNF-B2 (≤ 1 ms) cumplido con p99 ≈ 0,16 ms; RNF-B3/B4 son tests deterministas (`search-cost.spec.ts`).

### Web (Chromium, CPU ralentizada 4×, PokéAPI real)
- Escribir `charmander` con 60 ms entre teclas: **1 petición** (RNF-F1); repetir la búsqueda: **0 peticiones**.
- 1 carácter: 0 peticiones y pista visible (RNF-F4); la caché del cliente se cubre con tests unitarios y E2E.
- Una tarea larga de 74 ms (render del catálogo con CPU 4× más lenta); CLS durante el refinado **0,047** (< 0,1): procede del cambio de alto de la lista al pasar de 24 a pocos resultados, no del esqueleto (RNF-F2).
- Pasar del texto a los resultados: ≈330 ms con 4× de CPU, de los cuales 250 ms son el debounce.

### Desviaciones respecto al diseño
- Se añadió `serialization: false`/`useClone: false` a la caché (no estaba en el diseño; es la mayor ganancia).
- `Vary` y `ETag` no requirieron código (ya existían); se añadieron tests.
- El CLS pasó de «= 0» a «≤ 0,1» (ver RNF-F2): reducir la lista cambia el alto de la página por naturaleza.
- La utilidad web vive en `app/shared/` (no en `pages/`) para poder usarla desde `ui/`, el adaptador y las páginas sin romper las capas.
- Verificado en Docker con memoria + Redis: 12 consultas (`''`, `pika`, `pikchu`, `25`, ×3) responden en 6–15 ms de extremo a extremo (navegador → servidor web → BFF), todas `X-Cache: HIT`. Si una lectura viniera de Redis, el índice llega como objeto nuevo y la búsqueda se reconstruye una vez (solo tras expirar la memoria).

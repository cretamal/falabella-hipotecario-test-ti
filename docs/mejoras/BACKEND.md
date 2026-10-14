<div align="center">

# Mejoras de Backend

**Explorador de Pokémon**

| | |
|---|---|
| **Proyecto** | Explorador de Pokémon — Angular 21 + NestJS (BFF) |
| **Área** | Backend (BFF) |
| **Tecnologías** | NestJS 12 · PokéAPI · caché memoria/Redis · OpenAPI |
| **Tipo de documento** | Incremental (se amplía en cada mejora; nunca se reescribe) |
| **Versión** | 0.5 |
| **Estado** | Vigente |
| **Creado** | 2026-10-13 |
| **Última actualización** | 2026-10-13 |
| **Documento base** | [SDD §5](../SDD.md) (contratos) · [SDD §6](../SDD.md) (BFF) |

</div>

---

## Alcance

`apps/bff/` y el contrato `packages/contracts/`. Incluye API, caché, resiliencia, rendimiento, seguridad y observabilidad.

## Cómo usar este documento (incremental)

1. Toda mejora que cambie el contrato se refleja primero en `packages/contracts` y en las tablas de API del SDD y del README.
2. Las formas de PokéAPI siguen confinadas a `pokeapi.source.ts`; la lógica nueva va en `application/` detrás del puerto.
3. Cada comportamiento nuevo deja un test (servicio con fake del puerto, adaptador con `fetch` simulado o e2e de controlador).
4. Al cerrar una mejora: `npm test -w apps/bff`, `npm run lint -w apps/bff` y los E2E de la web.

Reglas del documento:

- Cada mejora tiene un **id estable** (`BE-NNN`) que no se reutiliza ni se renumera.
- Las mejoras **no se borran**: pasan por los estados `Propuesta` → `Aprobada` → `En curso` → `Hecha` (o `Descartada`, con el motivo).
- Cada cambio al documento agrega una fila al [registro de cambios](#registro-de-cambios) y sube la versión (menor: nueva mejora o cambio de estado; mayor: reestructuración).
- El detalle de cada mejora se agrega al final, en la sección [Detalle de mejoras](#detalle-de-mejoras), con la plantilla de abajo.

## Índice de mejoras

Prioridad: Alta · Media · Baja. Las mejoras iniciales son **propuestas sin priorizar definitivamente**, derivadas de las limitaciones conocidas del SDD (§10.2).

| Id | Mejora | Estado | Prioridad | Resumen |
|---|---|---|---|---|
| BE-001 | Nombres oficiales localizados en el catálogo | Propuesta | Media | Hoy se derivan de la clave; precalcular nombres de especie (1.350 llamadas) en segundo plano y cachearlos. |
| BE-002 | Calentamiento y refresco del índice | Propuesta | Alta | Construir el índice al arrancar y refrescarlo en segundo plano (stale-while-revalidate) para evitar el primer pedido lento (~1–2 s). |
| BE-003 | Servir datos obsoletos si PokéAPI cae | Propuesta | Alta | Conservar el último índice/detalle válido más allá del TTL y usarlo ante 502 (stale-if-error). |
| BE-004 | Marcar formas alternativas | Propuesta | Media | Exponer `isDefaultForm` / `speciesId` para que el front pueda ocultar o agrupar formas (habilita FE-003). |
| BE-005 | Observabilidad | Propuesta | Baja | Logs estructurados con id de petición, métricas (latencia, aciertos de caché, 5xx de PokéAPI). |
| BE-006 | Búsqueda: índice precalculado, relevancia, número y erratas | **Hecha** | Alta | Diseño completo y presupuestos en [`SDD-BUSQUEDA.md`](../SDD-BUSQUEDA.md); corrige que `q` de solo símbolos devuelve todo el catálogo. |
| BE-007 | Detalle: núcleo en una etapa, etiquetas baratas, calentamiento y SWR | **Hecha** | Alta | Diseño y presupuestos en [`SDD-DETALLE.md`](../SDD-DETALLE.md). Absorbe BE-002 y BE-003 para el detalle; el detalle en frío pasa de 3–4 etapas a 1. |

## Plantilla de entrada

Copiar al final de «Detalle de mejoras» al aprobar o iniciar una mejora:

```markdown
### BE-NNN · Título

- **Estado:** Propuesta | Aprobada | En curso | Hecha | Descartada
- **Prioridad:** Alta | Media | Baja
- **Fecha / versión:** AAAA-MM-DD · vX.Y
- **Motivo:** problema u oportunidad (qué duele hoy).
- **Alcance:** qué cambia y qué NO cambia.
- **Criterio de aceptación:** condiciones verificables.
- **Impacto:** archivos/capas afectados · secciones del SDD a actualizar · otras áreas (enlace a su documento).
- **Pruebas:** tests nuevos o actualizados, E2E y comprobaciones manuales.
- **Resultado:** (al cerrar) qué se hizo, commit/PR, desviaciones respecto al plan.
```

## Detalle de mejoras

_Aún no hay mejoras detalladas. Las entradas se agregan aquí, en orden de aprobación._

### BE-006 · Búsqueda: índice precalculado, relevancia, número y erratas

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-13 · v0.3
- **Diseño:** [`SDD-BUSQUEDA.md`](../SDD-BUSQUEDA.md) (resultados medidos en §13).
- **Solución:** `pokemon/application/search.ts` (claves normalizadas una vez por índice, relevancia exacto > prefijo > palabra > subcadena, número, varias palabras, difuso con distancia ≤ 1 solo con 0 coincidencias y ≥ 4 caracteres); `Page.fuzzy` opcional en el contrato; un texto que se reduce a nada devuelve 0 resultados (antes devolvía todo el catálogo); validación `q` ≤ 50 con limpieza de caracteres de control; `config/cache-store.ts` sin serialización ni clonado.
- **Resultado medido (benchmark, 1.350 entradas):** `list` de ≈1,6 ms a ≈0,04 ms (≈40×); peor caso difuso ≈0,09 ms. La mayor parte de la ganancia vino de la caché (cada lectura del índice costaba ≈1,3 ms).
- **Pruebas:** 26 nuevas (relevancia, número, erratas, límites, 304/`Vary`, coste determinista, paridad con el web); `npm run bench -w apps/bff` para vigilancia.
- **Consecuencias asumidas:** el orden de los resultados con texto cambia (relevancia); las constantes de búsqueda están duplicadas con el web (contracts es solo tipos) y se vigilan con `packages/contracts/search-fixtures.json`; sin Redis la caché trata lo guardado como inmutable.
- **Resultado:** completado el 2026-10-13.

### BE-007 · Detalle: núcleo en una etapa, etiquetas baratas, calentamiento y SWR

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-14 · v0.5
- **Diseño:** [`SDD-DETALLE.md`](../SDD-DETALLE.md) (resultados medidos en §13). Absorbe BE-002 y BE-003 para el detalle.
- **Solución:** `GET /api/pokemon/:name` (núcleo, con `thumbUrl`, sin `evolution`) y `GET /api/pokemon/:name/evolution`; resolución desde el índice (`IndexEntry.species`) con clave canónica y `pokemon ∥ species` en paralelo; etiquetas cacheadas solo como `Labels` y sembradas por `fetchIndex`; calentamiento al arrancar (índice + estadísticas); `Memoizer` con `put`, `peek` y SWR/stale-if-error; `PokeApiClient` comparte las peticiones en vuelo; TTL 24 h + 7 d obsoleto; `Cache-Control` del detalle `max-age=3600, stale-while-revalidate=86400`.
- **Resultado medido:** núcleo en frío de 760–1.295 ms a ≈ 240–320 ms (5 llamadas en vez de 14–19); caché caliente ≈ 4 µs.
- **Pruebas:** 36 nuevas (coste determinista por etapas, SWR, resolución, calentamiento, evolución, e2e del controlador); `test/profile-detail.mts` para perfilar contra PokéAPI real.
- **Consecuencias asumidas:** cambio de contrato no aditivo (`evolution` sale de `PokemonDetail`; BFF y web se despliegan juntos); datos hasta 7 días obsoletos si PokéAPI cae; claves de caché nuevas (`pokemon:v2:`, `label:`) hacen que los valores antiguos de Redis expiren solos.
- **Resultado:** completado el 2026-10-14.

## Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.5 | 2026-10-14 | Cierre de BE-007 (detalle) con mediciones. |
| 0.4 | 2026-10-13 | Alta de BE-007 (detalle) como propuesta, con su SDD; absorbe BE-002 y BE-003 para el detalle. |
| 0.3 | 2026-10-13 | Cierre de BE-006 (búsqueda) con mediciones. |
| 0.2 | 2026-10-13 | Alta de BE-006 (búsqueda) como propuesta, con su SDD. |
| 0.1 | 2026-10-13 | Creación del documento: carátula, reglas de uso, índice con 5 propuestas iniciales y plantilla de entrada. |

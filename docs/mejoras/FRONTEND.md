<div align="center">

# Mejoras de Frontend

**Explorador de Pokémon**

| | |
|---|---|
| **Proyecto** | Explorador de Pokémon — Angular 21 + NestJS (BFF) |
| **Área** | Frontend |
| **Tecnologías** | Angular 21 · SSR · i18n (es/en) · PWA · SCSS |
| **Tipo de documento** | Incremental (se amplía en cada mejora; nunca se reescribe) |
| **Versión** | 1.0 |
| **Estado** | Vigente |
| **Creado** | 2026-10-13 |
| **Última actualización** | 2026-10-13 |
| **Documento base** | [SDD §7](../SDD.md) (frontend) · [SDD §7.6](../SDD.md) (capa de estilos) |

</div>

---

## Alcance

`apps/web/` y la capa de estilos (`src/styles/`, `src/app/ui/`). Incluye UX/UI, accesibilidad, rendimiento percibido, i18n y PWA.

## Cómo usar este documento (incremental)

1. Ningún cambio visual fuera de `_tokens.scss` y los `.scss` de componentes/páginas; la lógica no depende de clases CSS.
2. No cambiar ids de i18n (`@@…`), roles/`aria-*` ni la estructura que usan los tests sin actualizar `*.spec.ts` y `e2e/`.
3. Todo texto nuevo lleva `i18n` y su traducción en `scripts/translate-en.py` (`npm run i18n -w apps/web`).
4. Al cerrar una mejora: `npm test`, `npm run lint` y `npm run build && npm run e2e` (incluye axe WCAG 2.1 AA).

Reglas del documento:

- Cada mejora tiene un **id estable** (`FE-NNN`) que no se reutiliza ni se renumera.
- Las mejoras **no se borran**: pasan por los estados `Propuesta` → `Aprobada` → `En curso` → `Hecha` (o `Descartada`, con el motivo).
- Cada cambio al documento agrega una fila al [registro de cambios](#registro-de-cambios) y sube la versión (menor: nueva mejora o cambio de estado; mayor: reestructuración).
- El detalle de cada mejora se agrega al final, en la sección [Detalle de mejoras](#detalle-de-mejoras), con la plantilla de abajo.

## Índice de mejoras

Prioridad: Alta · Media · Baja. Las mejoras iniciales son **propuestas sin priorizar definitivamente**, derivadas de las limitaciones conocidas del SDD (§10.2).

| Id | Mejora | Estado | Prioridad | Resumen |
|---|---|---|---|---|
| FE-001 | Rediseño visual y de UX/UI | Propuesta | Alta | Nueva identidad sobre los tokens: tipografía, jerarquía, tarjetas, detalle, estados vacíos/errores y microinteracciones. |
| FE-002 | Condiciones de evolución largas | Propuesta | Media | Leafeon/Glaceon listan 6 ubicaciones; resumir o plegar la lista conservando la información. |
| FE-003 | Formas alternativas en el catálogo | Propuesta | Media | Las formas (`pikachu-gmax`…) llenan el final del catálogo; ofrecer un interruptor «mostrar formas» o agruparlas (requiere BE-004). |
| FE-004 | Tema claro/oscuro manual | Propuesta | Baja | Hoy sigue `prefers-color-scheme`; añadir selector persistente. |
| FE-005 | Transiciones entre vistas | Propuesta | Baja | Transiciones de vista (View Transitions) catálogo ⇄ detalle, respetando `prefers-reduced-motion`. |
| FE-006 | Componentes reutilizables con Atomic Design | **Hecha** | Alta | Átomos → moléculas → organismos → plantillas → páginas, con capas verificadas por ESLint. |
| FE-007 | Enlaces como `<div>` con `routerLink` en lugar de `<a href>` | **Hecha** | Alta | Navegación interna con `RouterLink` sobre `<div>` (rol `link`, Enter) y `appHardLink` para otro idioma/externos. |
| FE-008 | Átomo `app-text`: etiqueta tipográfica dinámica | **Hecha** | Media | Un solo componente de texto con etiqueta elegida en runtime y pesos/variantes/tonos como tokens. |
| FE-009 | Skeleton personalizable y estados de carga por componente | **Hecha** | Media | Átomo `skeleton` con formas; los componentes de datos pintan su marcador cuando no reciben datos. |
| FE-010 | Búsqueda: caché, mínimo de caracteres y resultados conservados | **Hecha** | Alta | Decorador de gateway con LRU y deduplicación, regla de emisión (2 caracteres, Enter, Escape), sin esqueleto al refinar y aviso de resultados aproximados. Diseño en [`SDD-BUSQUEDA.md`](../SDD-BUSQUEDA.md). |
| FE-011 | Detalle: navegación optimista, precarga y compresión | **Hecha** | Alta | Hero instantáneo con el resumen, precarga por intención, evolución independiente, compresión, service worker `performance` y miniatura como marcador. Diseño en [`SDD-DETALLE.md`](../SDD-DETALLE.md). |
| FE-012 | Evolución en la cabecera de la ficha | **Hecha** | Media | La evolución pasa a la columna derecha del hero (variante compacta del árbol); desaparece el panel de abajo. |
| FE-017 | Tokenización de las claves transversales de SCSS | **Hecha** | Alta | Tipografía, bordes, opacidad, capas, movimiento, dimensiones y puntos de ruptura salen de tokens; un test lo hace cumplir. |
| FE-016 | Rediseño de «Estadísticas base» | **Hecha** | Baja | Barras por tramo de color, guías, entrada animada y resumen del total en una segunda zona. |
| FE-015 | Rediseño del bloque «Acerca de» | **Hecha** | Baja | Descripción y datos en dos zonas con divisor, métricas con icono y habilidades como chips. |
| FE-014 | Rejilla para cadenas con más de 3 ramas | **Hecha** | Media | Eevee y similares: etapa de origen arriba, ramas en rejilla (4 columnas; 2 en móvil) y condiciones plegables. |
| FE-013 | Precarga de las evoluciones | **Hecha** | Alta | Al ver un Pokémon se calientan en segundo plano sus etapas vecinas; abrirlas es instantáneo y sin marcadores. |

## Plantilla de entrada

Copiar al final de «Detalle de mejoras» al aprobar o iniciar una mejora:

```markdown
### FE-NNN · Título

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

### FE-006 · Componentes reutilizables con Atomic Design

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-13 · v0.2
- **Motivo:** los componentes vivían en `shared/ui` sin jerarquía y había lógica duplicada (fallo de imagen en tarjeta y etapa evolutiva, estilos de botón globales, secciones con el mismo borde repetidas). Se pidió que cada componente sea reutilizable y siga la metodología Atomic Design.
- **Alcance:** reorganizar `apps/web/src/app` en `ui/{atoms,molecules,organisms,templates}` y `pages/`. **No cambia** el comportamiento, los textos, los ids de i18n, los roles `aria-*` ni el aspecto visual (capturas antes/después equivalentes).
- **Estructura resultante:**

  | Capa | Componentes | Regla |
  |---|---|---|
  | Átomos | `badge`, `button` (atributo sobre `a`/`button`/`span`), `meter`, `pokemon-image`, `skeleton`, `type-chip` | Sin dependencias de otras capas; solo `input()`/`output()` |
  | Moléculas | `banner`, `evolution-stage`, `language-switch`, `pager`, `panel`, `pokemon-card`, `search-field`, `select-field`, `stat-bar`, `state-message` | Componen átomos |
  | Organismos | `app-footer`, `app-header`, `catalog-filters`, `evolution-panel`, `evolution-tree`, `pokemon-about`, `pokemon-grid`, `pokemon-hero`, `stats-panel` | Componen moléculas y átomos; conocen los contratos de datos pero no inyectan servicios |
  | Plantillas | `app-shell`, `page-layout` | Solo ranuras (`ng-content`), sin datos |
  | Páginas | `catalog`, `pokemon-detail`, `not-found` (+ `App` raíz) | Únicas que inyectan servicios (gateway, router, memoria) |

- **Reutilización lograda:** `pokemon-image` (tarjeta, ficha y etapa evolutiva, con marcador si falla), `button` (10 usos), `panel` (3 secciones de la ficha), `search-field` / `select-field` (3 campos del catálogo), `skeleton` (grilla y ficha).
- **Mejoras de comportamiento que salieron del refactor:** `catalog-filters` compara contra el valor vigente de la URL, no contra lo último emitido (si el usuario limpiaba filtros y volvía a escribir lo mismo, antes no se buscaba); `pokemon-image` se recupera al cambiar de imagen.
- **Capas verificadas por ESLint** (`eslint.config.js`): un átomo no puede importar moléculas, organismos ni plantillas; ninguna capa de `ui/` puede importar páginas, `core/`, `pokemon/` ni `HttpClient`. Comprobado con importaciones de prueba que el linter rechaza.
- **Criterio de aceptación:** `npm test`, `npm run lint` y `npm run build && npm run e2e` en verde; capturas equivalentes.
- **Impacto:** `apps/web` (carpetas, rutas lazy de `app.routes.ts`, `styles/_base.scss` sin `.button` global); SDD §3.3 y §7.6, README actualizados.
- **Pruebas:** 23 tests nuevos de componentes (átomos, moléculas, organismos) además de los 26 de páginas y servicios: 49 en total en el web. E2E: 25/25.
- **Resultado:** completado el 2026-10-13. Desviación: la lista de condiciones de evolución sigue larga (FE-002).

### FE-007 · Enlaces como `<div>` con `routerLink` en lugar de `<a href>`

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-13 · v0.3
- **Motivo:** decisión del solicitante: usar `<div>` con el enlace compatible de Angular en lugar de anclas `<a href>`.
- **Alcance:** los 11 enlaces de la app: tarjeta, etapa evolutiva, paginación (2), marca, «Volver al catálogo», «Ir al catálogo» (2), «Ir a la primera página», selector de idioma, enlace a PokéAPI del pie y «Saltar al contenido». **No cambia** el aspecto ni los textos.
- **Solución:** átomo `ui/atoms/link` con `RouterLinkRole` (`div[routerLink]` → `role="link"` + Enter) y `HardLink` (otro idioma / externos: `location.assign` o `window.open` con `noopener`; Ctrl/⌘+clic abre pestaña). `RouterLink` aporta el clic y el `tabindex="0"`. `button` admite ahora `<div appButton>`. En texto en línea (pie) se usa `<span>` porque un `<div>` dentro de `<p>` rompe la hidratación del SSR.
- **Criterio de aceptación:** ninguna `<a>` en el HTML del SSR; todos los enlaces con rol `link`, enfocables con Tab y activables con Enter; axe WCAG 2.1 AA sin violaciones; sin errores de consola/hidratación.
- **Impacto:** `ui/atoms/link` (nuevo), `button`, `pokemon-card`, `evolution-stage`, `pager`, `language-switch`, `app-header`, `app-footer`, `app-shell`, páginas; estilos base de `[role='link']`; SDD §7.7–7.8.
- **Consecuencias asumidas (a revisar si cambian los requisitos):** sin `href` no hay «abrir en nueva pestaña» desde el menú contextual ni clic central en enlaces internos, no se ve el destino al pasar el cursor, y la navegación no es rastreable por buscadores ni funciona sin JavaScript (el contenido sí se renderiza en el servidor). Se eliminaron `rel="prev|next"` del paginador.
- **Pruebas:** 5 tests nuevos (directivas de enlace con clic y Enter, `language-switch`) y pruebas de paginador/evolución reescritas para verificar la navegación real con el router; 54 en total en el web. E2E: 25/25 (incluye axe). Comprobado con Chromium: Tab + Enter sobre una tarjeta navega al detalle; 0 `<a>` y 30 `role="link"` en el HTML del catálogo.
- **Resultado:** completado el 2026-10-13.

### FE-008 · Átomo `app-text`: etiqueta tipográfica dinámica

- **Estado:** Hecha
- **Prioridad:** Media
- **Fecha / versión:** 2026-10-13 · v0.4
- **Motivo:** el texto (número, nombre, conteo, etiquetas, estados, descripciones) estaba marcado a mano en ~17 componentes, con la tipografía repetida (pesos `600`/`700` literales, tamaños y colores duplicados).
- **Solución:** átomo `ui/atoms/text` → `<app-text as variant weight tone align numeric text role live id for>`. La etiqueta (`h1`–`h6`, `p`, `span`, `strong`, `em`, `small`, `label`, `div`) se decide en runtime con `@switch` y el contenido se proyecta con un `ng-template` compartido (admite plurales ICU y texto con enlaces). Peso, variante y tono salen de tokens (`--font-weight-*`, `--line-height-tight`) aplicados por `data-*` en la hoja global `styles/_typography.scss`; no hay estilos en línea. `as` y `for` usan alias (palabras reservadas en plantillas).
- **Alcance:** número/nombre de tarjeta y ficha, género, conteo y estado de carga (con `role="status"`), etiquetas de buscador/selector/estadística, títulos y descripciones de panel y estado, paginador, total, nota de evolución y pie. **Fuera de alcance:** `li`/`dt`/`dd`/`option` (el contenedor `<app-text>` rompería la estructura HTML), enlaces (`brand`, `option` de idioma), `banner` y las líneas con chips (`.types`, `.meta`, `.how`; ahora `<div>`).
- **Criterio de aceptación:** mismo aspecto y mismos textos; lint, tests y E2E (axe AA) en verde; mensajes i18n sin cambios.
- **Impacto:** `ui/atoms/text` (nuevo), `_tokens.scss`, `_typography.scss`, `styles.scss` y los componentes migrados; SDD §7.7.
- **Consecuencias asumidas:** cada texto añade un nodo `<app-text>` (en jsdom ≈ ×2,5 el coste de render frente a la etiqueta nativa, ≈27 µs por texto; por verificar en navegador). Plan B si se midiera regresión: directiva `[appText]` sin envoltorio en las listas largas.
- **Pruebas:** 4 tests nuevos del átomo (cambio de etiqueta en runtime, data-attributes, proyección + role/aria-live, `for`); 58 en el web. E2E: 25/25.
- **Resultado:** completado el 2026-10-13.

### FE-009 · Skeleton personalizable y estados de carga por componente

- **Estado:** Hecha
- **Prioridad:** Media
- **Fecha / versión:** 2026-10-13 · v0.5
- **Motivo:** solo existía un bloque genérico (20 rem para toda la ficha) y el layout saltaba al llegar los datos.
- **Solución:** `app-skeleton` admite `shape` (`block | text | circle | image | chip`), `width`, `height` y `lines`; sigue decorativo (`aria-hidden`), y el anuncio «Cargando…» lo mantiene la página con `role="status"`. Los componentes que dependen de datos externos (`pokemon-card`, `pokemon-hero`, `pokemon-about`, `stats-panel`, `evolution-panel`) tienen el dato **opcional**: sin dato pintan su marcador con la misma estructura (`@if (dato(); as d) { contenido } @else { skeleton }`). El grid usa `<app-pokemon-card />` vacío; la ficha en carga monta los cuatro organismos sin datos (`aria-busy`). Los componentes siguen sin inyectar servicios.
- **Alcance:** solo `loading`/`ready` llevan skeleton; vacío y error mantienen `state-message`. **No se hizo** el tipo compartido `ViewState`: los estados de catálogo y detalle difieren (`notfound`, carga útil distinta) y compartirlo no quitaba código.
- **Corrección asociada:** `app-text` duplicaba el `role` estático en su host y en el elemento interno (doble anuncio); el host ya no lo conserva.
- **Pruebas:** 7 tests nuevos (átomo, estado de carga de los cinco componentes); 65 en el web. E2E 25/25.
- **Resultado:** completado el 2026-10-13.

### FE-010 · Búsqueda: caché, mínimo de caracteres y resultados conservados

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-13 · v0.7
- **Diseño:** [`SDD-BUSQUEDA.md`](../SDD-BUSQUEDA.md) (resultados en §13).
- **Solución:** `app/shared/search-query.ts` (normalización y reglas, con paridad vigilada contra el BFF); `catalog-filters` con mínimo de 2 caracteres (o un dígito), debounce de 250 ms **cancelable**, vaciar y Enter inmediatos, pista accesible (`aria-describedby`); `search-field` con Escape, `inputmode`/`enterkeyhint`/`spellcheck`; `CachedPokemonGateway` (decorador del puerto: clave canónica, LRU de 30, TTL 5 min, deduplicación en vuelo, errores no guardados); en la página, resultados anteriores atenuados y «Buscando…» (`stale`, `aria-busy`) en lugar del esqueleto, y aviso de resultados aproximados dentro de la misma región `role="status"`.
- **Resultado medido (Chromium, CPU 4×):** escribir una palabra = 1 petición; repetirla = 0; 1 carácter = 0; CLS 0,047.
- **Pruebas:** 29 nuevas (unitarias) y 9 E2E (relevancia, número, erratas, símbolos, mínimo, conteo de peticiones, Enter/Escape, sin esqueleto al refinar, axe con resultados aproximados).
- **i18n:** `@@filters.searchHint`, `@@catalog.searching`, `@@catalog.fuzzy`.
- **Resultado:** completado el 2026-10-13.

### FE-011 · Detalle: navegación optimista, precarga y compresión

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-14 · v0.9
- **Diseño:** [`SDD-DETALLE.md`](../SDD-DETALLE.md) (resultados en §13).
- **Solución:** `NavigationHint` + `pokemon-hero` con `summary` (cabecera al instante); `CachedPokemonGateway` con caché de `detail`/`evolution` y `prefetchDetail` (≤ 2 en vuelo, 1 por Pokémon, sin `saveData`); tarjeta con `selected` e `intent` (150 ms, toque inmediato); página con núcleo y evolución independientes (evolución solo en el navegador) y `evolution-panel` con skeleton y reintento; `pokemon-image` con miniatura de marcador y `fetchpriority="high"`; `compression` en el servidor web; `ngsw` con `performance` para el detalle; `PreloadAllModules`.
- **Hallazgo y corrección:** el transfer cache de Angular nunca funcionó (la clave del servidor era la URL absoluta del BFF y la del navegador la relativa). `apiOriginBackend` (HttpBackend) sustituye al interceptor y la hidratación reutiliza ya las respuestas: la carga directa del detalle pasa de 3 peticiones del navegador a 1 (la evolución) y la del catálogo de 2 a 0.
- **Resultado medido (Chromium, PokéAPI real):** clic → título 76–105 ms aunque el BFF tarde 1,5 s; LCP del detalle 1,7–1,9 s con CPU 4× y 4G lento.
- **Pruebas:** 38 nuevas (unitarias) y 10 E2E (clic → título con BFF lento, axe del estado intermedio, reabrir sin peticiones, precarga y su cancelación, evolución con error recuperable, carga directa, API separada, compresión, grupo del service worker).
- **i18n:** `@@detail.evolution.error`.
- **Resultado:** completado el 2026-10-14.

### FE-012 · Evolución en la cabecera de la ficha

- **Estado:** Hecha
- **Prioridad:** Media
- **Fecha / versión:** 2026-10-14 · v1.0
- **Motivo:** el hero tenía ≈430 px libres a la derecha de la identidad; la evolución estaba en un panel aparte al final de la página.
- **Solución:** `pokemon-hero` expone la ranura `[heroAside]` (proyección, para no importar un organismo desde otro) y la página proyecta ahí `evolution-panel`, ahora compacto y sin tarjeta (título pequeño, `section` accesible); `evolution-tree` y `evolution-stage` ganan `compact` (miniatura de 48 px, condiciones de 5 rem, ramas en filas con `flex-wrap`). La ranura decide su diseño con una container query (`container-type` en el hero): bajo 64 rem la columna pasa bajo la identidad y su divisor a la parte superior; en ≤ 40 rem el árbol vuelve a su disposición vertical. Sin evolución, la columna se oculta (`display: none`). Marcadores: tres círculos de 56 px con alto reservado, también en el hero sin datos. El panel de abajo se eliminó.
- **Hallazgo:** un `id="x"` estático en `<app-text>` queda en el host **y** en el elemento interno (id duplicado); el test lo detectó y se usa `[id]="'x'"`. Documentado en el propio componente.
- **Medido (1280 px):** hero 330 px con 2–5 etapas (Archaludon, Pikachu, Wurmple) y sin evolución (Mew); Eevee, con 8 ramas y condiciones largas, 621 px.
- **Pruebas:** 9 unitarias nuevas o ajustadas y 4 E2E (columna a la derecha de la identidad y panel único, sin columna vacía, bajo la identidad a 800 px, Eevee sin desbordar). E2E: 48/48 con axe.
- **Consecuencias asumidas:** en Pokémon con muchas ramas y lugares de evolución la cabecera crece; el texto no se recorta. En móvil se conserva el árbol vertical de siempre.
- **Resultado:** completado el 2026-10-14.

### FE-013 · Precarga de las evoluciones

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-14 · v1.1
- **Motivo:** pulsar una etapa pedía su detalle y otra vez la evolución (mismo árbol), con cabecera vacía, marcador en la columna y artwork que llegaba tarde.
- **Solución:** con la evolución cargada, la página precarga en reposo las ≤ 4 etapas más cercanas (`evolutionTargets`) vía `prefetchDetail`; `evolution-stage` emite `intent` (cursor/foco 150 ms o toque) para el resto. `CachedPokemonGateway` siembra el árbol bajo el id y nombre de cada etapa y baja el artwork de cada detalle precargado; caché de detalle 20 → 30. Sin cambios en BFF ni contrato. Detalle en `SDD-DETALLE.md` §6.8.
- **Pruebas:** 12 unitarias nuevas (150 en web) y 1 E2E nuevo; los dos E2E que contaban peticiones se ajustaron para esperar la precarga. E2E: 48/48 con axe.
- **Consecuencias asumidas:** hasta 4 detalles extra por visita (Eevee, 8 ramas, solo precarga las 4 más cercanas); con `saveData` no se precarga.
- **Resultado:** completado el 2026-10-14.

### FE-014 · Rejilla para cadenas con más de 3 ramas

- **Estado:** Hecha
- **Prioridad:** Media
- **Fecha / versión:** 2026-10-14 · v1.2
- **Motivo:** con 8 ramas (Eevee) el árbol en filas partía las condiciones largas (listas de lugares) en columnas de 5 rem, con filas desalineadas, flechas repetidas y una cabecera de 621 px (≈ 2.100 px en móvil).
- **Solución:** `evolution-tree` pasa a modo `wide` cuando un nodo tiene más de `WIDE_BRANCHES` (3) hijos (`shared/evolution-layout.ts`): la etapa de origen arriba, un único conector «↓» y las ramas en rejilla de 4 columnas (2 en ≤ 40 rem), con la etapa y sus condiciones en vertical. Nueva molécula `evolution-conditions`: muestra la primera condición y el resto bajo «+N más» (`aria-expanded`). Sigue en la columna derecha de la cabecera (a todo ancho quedaba en 764 px, peor). Hasta 3 ramas no cambia nada.
- **Medido:** hero de Eevee 621 → 488 px en escritorio (1280 px) y ≈ 2.100 → 1.253 px en móvil (375 px).
- **Pruebas:** 8 unitarias nuevas (156 en web) y 2 E2E (escritorio: 9 etapas, hero < 560 px, sin desbordar, plegable; móvil < 1.500 px). E2E: 50/50 con axe.
- **i18n:** `@@evolution.more`, `@@evolution.less`. BFF sin cambios.
- **Consecuencias asumidas:** las condiciones secundarias quedan tras un clic; Leafeon y Glaceon muestran solo su primer lugar hasta desplegar.
- **Resultado:** completado el 2026-10-14.

### FE-015 · Rediseño del bloque «Acerca de»

- **Estado:** Hecha
- **Prioridad:** Baja
- **Fecha / versión:** 2026-10-14 · v1.3
- **Motivo:** en pantalla ancha el texto flotaba con un hueco a la derecha y Altura, Peso y Habilidades quedaban a ~600 px entre sí, con jerarquía plana y la insignia «oculta» pegada al nombre.
- **Solución:** `pokemon-about` en dos zonas (`grid`: descripción a 1,25 rem con `text-wrap: pretty` | datos de ≤ 22 rem con divisor), apiladas bajo 56 rem; Altura y Peso como métricas con icono SVG inline y etiqueta en mayúsculas tenue; Habilidades como chips (`flex-wrap`), la oculta con icono de ojo tachado y texto accesible «habilidad oculta» (ya no usa `app-badge`). Sin descripción, los datos ocupan todo el ancho. El skeleton replica las dos zonas. Se mantiene `dl/dt/dd`.
- **Pruebas:** 4 unitarias nuevas (160 en web); E2E 50/50 con axe (modo claro y oscuro revisados con capturas).
- **i18n:** `@@detail.hiddenAbility` cambia a «habilidad oculta» («hidden ability»). BFF sin cambios. El acento por tipo queda para FE-001.
- **Resultado:** completado el 2026-10-14.

### FE-016 · Rediseño de «Estadísticas base»

- **Estado:** Hecha
- **Prioridad:** Baja
- **Fecha / versión:** 2026-10-14 · v1.4
- **Motivo:** lista a 40 rem con un tercio del panel vacío, todas las barras del mismo color (sin información), sin referencias en la escala 0–255, y un total desalineado que parecía una fila suelta.
- **Solución:** `stats-panel` en dos zonas (barras | resumen con divisor; apiladas bajo 56 rem). El átomo `app-meter` deja el `<meter>` nativo (no se podía colorear por tramo ni animar) por un `role="meter"` con `aria-valuenow/max/valuetext`, color por tramo (`tone`: bajo < 50, medio < 90, alto < 120, excepcional; tokens `--stat-*` en claro y oscuro), guías cada 50 y entrada animada solo CSS (0,6 s, escalonada, sin movimiento con `prefers-reduced-motion`). `stat-bar` usa `subgrid`: las filas comparten el ancho de la etiqueta más larga. El resumen muestra el total en grande, su barra (escala 720) y su nivel (< 300 bajo, < 450 medio, < 550 alto, ≥ 550 excepcional; `stat-tier.ts`). El skeleton replica ambas zonas.
- **Pruebas:** 5 unitarias nuevas (165 en web: átomo, tramos con `aria-valuetext`, total y nivel, skeleton); E2E 50/50 con axe; capturas en claro, oscuro y móvil.
- **i18n:** `@@stats.tier.{low,mid,high,top}`. BFF y contrato sin cambios.
- **Consecuencias asumidas:** el color no es el único indicador (valor numérico y texto accesible). La escala sigue siendo 0–255 fija para poder comparar entre fichas.
- **Resultado:** completado el 2026-10-14.

### FE-017 · Tokenización de las claves transversales de SCSS

- **Estado:** Hecha
- **Prioridad:** Alta
- **Fecha / versión:** 2026-10-14 · v1.5
- **Motivo:** el rediseño visual (FE-001) debe poder hacerse editando solo la capa de estilos, pero quedaban valores sueltos repartidos en 25 `.scss`: pesos 600/700, `0.75rem`, interlineados 1,1/1,25/1,5/1,6, `letter-spacing`, bordes de 1/2/3 px, opacidades, `z-index`, duraciones, alturas de cabecera y controles, medidas de lectura, bases de columnas y los anchos de las media queries (21 de 31 archivos).
- **Solución:** `_tokens.scss` ordenado por familias y ampliado: `--font-size-xs`, `--line-height-{display,snug,relaxed}`, `--letter-spacing-caps`, `--space-half`, `--radius-round`, `--border-width{,-strong}`, `--focus-ring-{width,offset}`, `--opacity-{disabled,pending}`, `--z-overlay`, `--motion-{enter,stagger,shimmer}`, `--duration-reduced` y dimensiones (`--header-height`, `--control-height`, `--field-min-width`, `--select-arrow-gutter`, `--meter-height`, `--icon-size{,-sm}`, `--artwork-size`, `--measure{,-narrow}`, `--aside-basis`, `--aside-min-height`, `--identity-basis`, `--side-panel-width{,-wide}`). Los puntos de ruptura no pueden ser variables CSS: nuevo `_breakpoints.scss` (Sass: `$sm/$md/$lg` + mixins `down`, `above`, `container-down`) accesible con `@use 'breakpoints' as bp` (`stylePreprocessorOptions.includePaths`). Los 25 componentes y las hojas base se conectaron a los tokens sin cambio visual (mismos valores).
- **Garantía:** `apps/web/scripts/check-tokens.test.mjs` (Node, 17 pruebas, en `npm test`) falla ante colores, pesos, `font-size`, `line-height`, `letter-spacing`, radios, sombras, `z-index`, opacidades, duraciones, grosores de borde o anchos de media query literales fuera de los tokens; ante un `var(--x)` inexistente; si el modo oscuro no redefine un color del claro; si faltan los tokens de los 18 tipos; o si el color de marca/fondo del `manifest` y de `index.html` se aparta de los tokens. Se comprobó con una mutación (7 reglas saltaron).
- **Hallazgo:** `PokemonAbout` importaba `Badge` sin usarlo desde FE-015 (aviso NG8113); eliminado.
- **Pruebas:** 17 de la guardia (267 en total); E2E 50/50 con axe; build SSR sin avisos.
- **Consecuencias asumidas:** las dimensiones propias de un solo componente (p. ej. ancho de la columna de valores de las barras) siguen locales; solo se tokenizó lo que se repite o es transversal.
- **Resultado:** completado el 2026-10-14.

## Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.5 | 2026-10-14 | Alta y cierre de FE-017 (tokenización de SCSS y guardia de estilos). |
| 1.4 | 2026-10-14 | Alta y cierre de FE-016 (rediseño de «Estadísticas base»). |
| 1.3 | 2026-10-14 | Alta y cierre de FE-015 (rediseño de «Acerca de»). |
| 1.2 | 2026-10-14 | Alta y cierre de FE-014 (rejilla para cadenas con más de 3 ramas). |
| 1.1 | 2026-10-14 | Alta y cierre de FE-013 (precarga de las evoluciones). |
| 1.0 | 2026-10-14 | Alta y cierre de FE-012 (evolución en la cabecera). |
| 0.9 | 2026-10-14 | Cierre de FE-011 (detalle) con mediciones; corrección del transfer cache. |
| 0.8 | 2026-10-13 | Alta de FE-011 (detalle) como propuesta, con su SDD. |
| 0.7 | 2026-10-13 | Cierre de FE-010 (búsqueda) con mediciones. |
| 0.6 | 2026-10-13 | Alta de FE-010 (búsqueda) como propuesta, con su SDD. |
| 0.5 | 2026-10-13 | Alta y cierre de FE-009 (skeleton y estados de carga por componente). |
| 0.4 | 2026-10-13 | Alta y cierre de FE-008 (átomo `app-text` y tipografía por tokens). |
| 0.3 | 2026-10-13 | Alta y cierre de FE-007 (enlaces como `<div>` con `routerLink`), con sus consecuencias asumidas. |
| 0.2 | 2026-10-13 | Alta y cierre de FE-006 (Atomic Design) con su detalle. |
| 0.1 | 2026-10-13 | Creación del documento: carátula, reglas de uso, índice con 5 propuestas iniciales y plantilla de entrada. |

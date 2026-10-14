<div align="center">

# Mejoras de Arquitectura

**Explorador de Pokémon**

| | |
|---|---|
| **Proyecto** | Explorador de Pokémon — Angular 21 + NestJS (BFF) |
| **Área** | Arquitectura |
| **Tecnologías** | Monorepo npm workspaces · puertos y adaptadores · Docker · GitHub Actions |
| **Tipo de documento** | Incremental (se amplía en cada mejora; nunca se reescribe) |
| **Versión** | 0.1 |
| **Estado** | Vigente |
| **Creado** | 2026-10-13 |
| **Última actualización** | 2026-10-13 |
| **Documento base** | [SDD §3–4](../SDD.md) (arquitectura y capa desacoplada) · [SDD §10](../SDD.md) (decisiones y límites) |

</div>

---

## Alcance

Decisiones transversales entre `apps/web`, `apps/bff` y `packages/contracts`: límites entre capas, contratos, despliegue, CI/CD y registro de decisiones.

## Cómo usar este documento (incremental)

1. Una decisión de arquitectura se registra aquí (y, si es definitiva, en SDD §10.1) **antes** de implementarse.
2. Se respeta la regla de dependencias hacia adentro y los puertos `PokemonSource` / `PokemonGateway`; cualquier excepción se justifica por escrito.
3. Un cambio que afecte a más de un área se documenta una vez aquí y se enlaza desde `FRONTEND.md` / `BACKEND.md`.
4. Se actualiza el SDD (versión y estado) cuando una mejora aprobada cambia lo construido.

Reglas del documento:

- Cada mejora tiene un **id estable** (`AR-NNN`) que no se reutiliza ni se renumera.
- Las mejoras **no se borran**: pasan por los estados `Propuesta` → `Aprobada` → `En curso` → `Hecha` (o `Descartada`, con el motivo).
- Cada cambio al documento agrega una fila al [registro de cambios](#registro-de-cambios) y sube la versión (menor: nueva mejora o cambio de estado; mayor: reestructuración).
- El detalle de cada mejora se agrega al final, en la sección [Detalle de mejoras](#detalle-de-mejoras), con la plantilla de abajo.

## Índice de mejoras

Prioridad: Alta · Media · Baja. Las mejoras iniciales son **propuestas sin priorizar definitivamente**, derivadas de las limitaciones conocidas del SDD (§10.2).

| Id | Mejora | Estado | Prioridad | Resumen |
|---|---|---|---|---|
| AR-001 | Persistencia opcional detrás del puerto | Propuesta | Baja | Decisión diferida (SDD §10.1 #13): si aparecen datos propios (favoritos, historial) o se quiere servir con PokéAPI caída, evaluar adaptador/módulo con base de datos. |
| AR-002 | Versionado de la API | Propuesta | Media | Prefijo `/api/v1` y política de compatibilidad del contrato web ⇄ BFF. |
| AR-003 | Registro de decisiones (ADR) | Propuesta | Baja | Pasar las decisiones de SDD §10.1 a ADRs numerados y enlazarlos desde el SDD. |
| AR-004 | Despliegue público | Propuesta | Media | Hosting para una demo pública (imágenes publicadas, variables, dominio) sin cambiar la ejecución local. |
| AR-006 | Documentación del código en español de Chile | **Hecha** | Media | Cada función, método y clase dice cuál es su responsabilidad; convención de tono y de qué se documenta. |
| AR-005 | Caché de borde para el SSR | Propuesta | Baja | CDN/caché HTTP delante del servidor web aprovechando `Cache-Control`/`Vary` del BFF. |

## Plantilla de entrada

Copiar al final de «Detalle de mejoras» al aprobar o iniciar una mejora:

```markdown
### AR-NNN · Título

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

### AR-006 · Documentación del código en español de Chile

- **Estado:** Hecha
- **Prioridad:** Media
- **Fecha / versión:** 2026-10-14 · v0.2
- **Motivo:** había clases y piezas bien explicadas, pero cerca de 200 funciones, métodos, tipos y helpers (backend, frontend, contratos, utilidades de test y de medición) no decían qué responsabilidad tienen; quien llega nuevo tenía que leer la implementación para entenderlas.
- **Alcance:** comentarios JSDoc (`/** … */`) en `apps/bff/src`, `apps/bff/test`, `apps/web/src`, `apps/web/test-support`, `apps/web/e2e` y `packages/contracts/src`. No cambia ninguna lógica, firma ni plantilla. Los comentarios que ya existían también se reescribieron al tono de la convención, de modo que todo el código lee con una sola voz.
- **Convención:** español de Chile semi formal y tono humano (se explica el porqué, se advierten los ojos de buey y se evitan los latiguillos). Cada función, método, clase, tipo exportado y constante no obvia lleva su responsabilidad en una o dos frases; se documenta *qué hace y por qué existe*, no se repite el nombre. Los tests se explican por el título de su `it`.
- **Criterio de aceptación:** ninguna función, método, clase, tipo ni constante exportada sin comentario, tests y utilidades incluidos (verificado con la API del compilador de TypeScript: 396 declaraciones y 555 comentarios, 0 problemas); lint, tests y E2E siguen en verde.
- **Guardia permanente:** `scripts/check-docs.mjs` (`npm run docs:check`, también dentro de `npm run lint`) revisa la cobertura con el compilador y falla ante léxico de España o comentarios en inglés. Se probó con una mutación (función sin comentario y comentario en inglés con «coger» y «ordenador»: ambos detectados).
- **Pruebas:** `npm run lint`, `npm test` (BFF 74 + 11, web 165, guardia de estilos 17) y `npm run e2e` (50/50).
- **Resultado:** completado el 2026-10-14.

## Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.2 | 2026-10-14 | Alta y cierre de AR-006 (documentación del código en español de Chile). |
| 0.1 | 2026-10-13 | Creación del documento: carátula, reglas de uso, índice con 5 propuestas iniciales y plantilla de entrada. |

## Contexto del código (Graphify)

El proyecto tiene un grafo de conocimiento en `graphify-out/` (god nodes, comunidades, relaciones entre archivos).

- Al iniciar cada sesión, lee `graphify-out/GRAPH_REPORT.md` antes de explorar archivos.
- Para entender relaciones o ubicar código usa primero `/graphify query "<pregunta>"` (o `graphify query` en terminal), `/graphify path "<A>" "<B>"` o `/graphify explain "<nodo>"`, antes del primer grep o lectura de código. Solo después abre archivos concretos, y lee solo las líneas que el grafo ya ubicó. Incluye esta regla en el prompt de todo subagente que explore código.
- Si existe `graphify-out/wiki/index.md`, úsalo para navegación amplia en vez de explorar el código crudo.
- Tras cambios de código, ejecuta `graphify update .` (solo AST, sin costo de API). Tras cambios estructurales (módulos nuevos, renombres, refactors), ejecuta `/graphify . --update`.
- Las relaciones INFERRED o AMBIGUOUS se verifican en el código antes de darlas por ciertas.
- Si `graphify-out/graph.json` se versiona, se reescribe completo en cada build: un diff grande sobre él en un PR es esperado; no lo marques como ruido ni sugieras omitir el rebuild o los hooks.

## Forma de trabajo (Agent Skills)

- Tareas nuevas o con requisitos poco claros: /spec y luego /plan.
- Implementación: /build (incremental-implementation) con /test (test-driven-development).
- Errores: debugging-and-error-recovery.
- Antes de dar por terminado: /review; si toca auth, datos sensibles o entradas de usuario, también security-and-hardening.
- Commits y despliegue: git-workflow-and-versioning y /ship.
- Cambios triviales (typos, una línea) no requieren spec ni plan.

## Estilo de código (Ponytail)

- Escribe solo lo que la tarea necesita; reutiliza lo existente y la librería estándar antes de agregar código o dependencias.
- Nunca recortes validación, manejo de errores, seguridad, accesibilidad ni tests requeridos por Agent Skills.
- Antes de cerrar una tarea con cambios de código, ejecuta /ponytail-review.

## Prioridad si hay conflicto

Seguridad y correctitud > requisitos del usuario > proceso de Agent Skills > minimalismo de Ponytail.

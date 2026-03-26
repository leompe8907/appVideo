# Reestructuración completa Preloader -> Home

Documento de referencia para estabilizar y reorganizar el flujo de datos entre `preload`, `home/bouquets`, `home/vod` y `home/epg`, evitando recargas innecesarias y pérdida de estado al navegar o con el paso del tiempo.

## Contexto y síntomas reportados

- Después de cierto tiempo en `canales`, al pasar a `películas (VOD)` se vuelve a descargar catálogo completo.
- También ocurre en sentido inverso con `canales` y `EPG`, donde se percibe pérdida de información y nuevas cargas.
- El objetivo es rediseñar el flujo de manera estructural, empezando por entender la lógica actual y luego migrar por etapas con bajo riesgo.

## Diagnóstico del estado actual

### 1) Dos modelos de estado en paralelo

- `EPG/Canales` se apoyan en `Zustand` (`src/store/preloadStore.js`).
- `VOD/Ads` en UI se apoyan en `React Query` (`src/query/hooks/useVodQuery.js`, `src/query/hooks/useAdsQuery.js`).
- Esto genera ciclos de vida diferentes y políticas de expiración distintas por módulo.

### 2) Expiración de cache de VOD por tiempo

- `useVodQuery` usa `staleTime: 10m` y `gcTime: 15m`.
- Si no hay observadores activos en esa query durante suficiente tiempo, React Query puede liberar cache y forzar recarga al volver a VOD.

### 3) Sesión validada en background con posible impacto de navegación

- `useAuthValidator` valida sesión al entrar y cada 5 minutos.
- Ante fallo, hace `setLoggedOut()` + `navigate('/')`.
- Si hay errores transitorios de red/servicio, el efecto percibido puede ser "perdida de estado" por reinicio de flujo.

### 4) Acoplamiento de preload con rutas

- `PreloadGate` redirige a `/preload` cuando `epg` no está listo.
- La lógica funciona, pero depende de un estado que puede entrar/salir de disponibilidad por condiciones no unificadas entre dominios.

## Objetivos de la reestructuración

1. Definir una sola estrategia de estado/caché para Home y submódulos.
2. Evitar que la navegación entre subrutas provoque refetch completo sin necesidad.
3. Separar claramente: error transitorio vs sesión inválida real.
4. Estandarizar TTL, refresco en background y reglas de invalidez.
5. Mantener UX fluida en TV (sin pantallas de carga inesperadas).

## Arquitectura objetivo (propuesta)

## Opción recomendada: Orquestador de datos de Home

Crear una capa `homeDataOrchestrator` que centralice decisiones:

- `ensureData({ epg, vod, ads, catchup })`
- `shouldRefresh(domain, now, lastLoadedAt, ttl)`
- `getStatus(domain)` con estados homogéneos
- `refreshInBackground(domain)` sin bloquear navegación

### Principios

- `Single source of truth` por dominio de datos.
- Misma semántica de estado en todos los dominios: `idle | loading | ready | stale | error`.
- TTL explícito configurable por marca cuando aplique.
- Reintentos controlados y deduplicación de requests.
- Trazabilidad de por qué se refresca (`reason`).

## Alternativas robustas (sin romper app)

Las siguientes alternativas están pensadas para adopción gradual, con compatibilidad hacia atrás y rollback simple por feature flag.

### Alternativa 1 - Unificar todo en TanStack Query

Idea:
- Migrar `EPG/Canales/Catchup` al mismo modelo de `Query` que hoy ya usan `VOD/Ads`.
- Definir queries por dominio (`homeEpg`, `homeVod`, `homeAds`, `homeCatchup`) y una capa `ensureHomeQueries`.

Librerías:
- Ya existe `@tanstack/react-query` en el proyecto.
- Opcional para persistencia de cache: `@tanstack/react-query-persist-client`.

Cómo implementarla sin romper:
1. Mantener `usePreload()` actual como fachada.
2. Internamente, hacer que `usePreload()` lea progresivamente de queries.
3. Migrar primero `VOD + Ads` (ya están cerca), luego `EPG/Canales`.
4. Activar por `feature flag` por brand.

Ventajas:
- Una sola política de `staleTime/gcTime/retry` para todos los dominios.
- Mejor deduplicación de requests y soporte nativo de refresh en background.
- Menor código manual de estados de carga/error.

Riesgos:
- Requiere mapear bien progreso de `EPG` (progress por canal) a estado de query.
- Si no se define bien TTL por dominio, puede crecer memoria en TV.

### Alternativa 2 - Consolidar en Zustand (store único con persistencia selectiva)

Idea:
- Mantener todo el dominio Home en `Zustand`, eliminando mezcla con Query para pantallas Home.
- Implementar store por slices (`epgSlice`, `vodSlice`, `adsSlice`, `catchupSlice`) y `orchestratorSlice`.

Librerías:
- Ya existe `zustand`.
- Opcional recomendado: middleware `persist` y `subscribeWithSelector` de `zustand/middleware`.

Cómo implementarla sin romper:
1. Mantener hooks de UI existentes (`useVodQuery`, `useAdsQuery`) como wrappers temporales que lean desde store.
2. Migrar `VodPage` y `HomeShellContent` al store consolidado.
3. Dejar `React Query` solo para módulos fuera de Home, o retirarlo luego.
4. Introducir `versionado` de estado persistido para migraciones seguras.

Ventajas:
- Control total sobre estados, TTL y política de invalidación.
- Ideal para TV cuando se necesita continuidad fuerte entre pantallas.
- Facilita compartir `progress` detallado entre preload y submódulos.

Riesgos:
- Hay que construir manualmente parte de capacidades que Query ya resuelve (retry, stale, dedupe).
- Persistir de más puede dejar datos obsoletos si no hay invalidación sólida.

### Alternativa 3 - Arquitectura híbrida controlada (orquestador + contrato de dominio)

Idea:
- Mantener coexistencia `Zustand + Query`, pero bajo un único contrato de orquestación.
- `Orquestador` decide qué se refresca, cuándo y por qué; la UI no dispara reglas ad hoc.

Librerías:
- Sin librerías nuevas obligatorias.
- Opcional para robustez de flujo: `xstate` para modelar estados del orquestador (`idle/loading/ready/stale/error/recovering`).

Cómo implementarla sin romper:
1. Crear `homeDataOrchestrator` sin cambiar pantallas (solo lectura/diagnóstico al inicio).
2. Mover decisiones de refresh desde páginas al orquestador.
3. Normalizar TTL y razones de invalidación en un archivo de política (`homeDataPolicy`).
4. Finalmente, decidir si converger en Query o Zustand, ya con métricas reales.

Ventajas:
- Menor riesgo inicial (cambio incremental, no big bang).
- Permite estabilizar rápido y medir antes de migrar completamente.
- Compatible con el código actual y con etapas de rollback muy simples.

Riesgos:
- Mantiene complejidad dual durante una etapa intermedia.
- Requiere disciplina para que ningún módulo salte el orquestador.

### Recomendación práctica

- Corto plazo (rápido y seguro): **Alternativa 3**.
- Mediano plazo (menor deuda técnica): **Alternativa 1**.
- Si prioridad es control fino y continuidad local en TV: **Alternativa 2**.

## Plan de migración por fases

## Fase 0 - Observabilidad y baseline (rápida, bajo riesgo)

Objetivo: medir y entender con precisión por qué se recarga cada dominio.

Tareas:
- Agregar logs estructurados de transición de estado por dominio (`epg`, `vod`, `ads`, `catchup`).
- Registrar cada fetch con `reason`: `initial`, `ttl-expired`, `manual`, `error-recovery`, `session-refresh`.
- Añadir marca temporal (`lastLoadedAt`) homogénea y visible en logs.

Resultado esperado:
- Evidencia clara de qué dispara cada recarga.

## Fase 1 - Estabilización inmediata (sin gran refactor)

Objetivo: reducir recargas percibidas y cortes de flujo.

Tareas:
- Ajustar política de caché de VOD para sesiones largas de TV (evitar GC agresivo).
- Endurecer manejo de validación de sesión para no cerrar sesión al primer fallo transitorio.
- Mantener datos válidos en pantalla mientras ocurre refresh en background.

Resultado esperado:
- Menos recargas completas al alternar entre `bouquets`, `vod`, `epg`.

## Fase 2 - Unificación de estado Home

Objetivo: eliminar el comportamiento divergente entre módulos.

Tareas:
- Introducir `homeDataOrchestrator` y moverle las reglas de refresh/invalidez.
- Definir contrato de dominio para `EPG`, `VOD`, `Ads`, `Catchup`.
- Consumir datos de Home desde una capa unificada (evitar que cada página decida su propia política en forma aislada).

Resultado esperado:
- Comportamiento consistente e independiente de la subruta visitada.

## Fase 3 - Limpieza y consolidación

Objetivo: simplificar mantenimiento.

Tareas:
- Eliminar rutas/lógica legacy que queden duplicadas tras la unificación.
- Documentar arquitectura final y guías de extensión.
- Dejar tests/regresiones automatizables para escenarios críticos.

Resultado esperado:
- Menos complejidad accidental y menor probabilidad de regresión.

## Criterios de aceptación

- Navegar `bouquets -> vod -> bouquets -> epg -> vod` durante 30+ minutos sin recargas completas innecesarias.
- VOD no pierde catálogo al volver desde otras subrutas dentro de ventana configurada.
- EPG/canales mantienen disponibilidad y solo refrescan según TTL o invalidación explícita.
- Errores transitorios de red no fuerzan logout inmediato.
- Si hay sesión realmente inválida, el fallback de autenticación ocurre de forma consistente.

## Matriz mínima de pruebas (manual)

1. Sesión estable, red estable: navegación continua por 30 minutos.
2. Sesión estable, red intermitente: validar degradación controlada sin perder estado en UI.
3. VOD inactivo > ventana histórica del bug: volver a `home/vod` y verificar si reutiliza cache.
4. Cambio rápido entre `home/bouquets` y `home/epg`: validar que no se dispare recarga completa repetitiva.
5. Validación periódica de sesión en segundo plano: confirmar que no expulsa por timeout puntual.

## Riesgos y mitigación

- Riesgo: romper el flujo de preload inicial.
  - Mitigación: feature flag de orquestador + fallback al flujo actual.
- Riesgo: incrementar consumo de memoria por mayor persistencia de cache.
  - Mitigación: TTL por dominio y limpieza selectiva en logout/cambio de brand.
- Riesgo: regresiones de navegación/foco en TV.
  - Mitigación: pruebas de control remoto y stress de navegación en hardware objetivo.

## Entregables recomendados

- Documento de arquitectura final.
- Checklist de migración por PR.
- Registro de decisiones técnicas (ADR corto) para políticas de caché y validación de sesión.
- Matriz de pruebas ejecutada por versión.

## Estado

- Documento creado como base de trabajo.
- Próximo paso recomendado: ejecutar Fase 0 y Fase 1 en una rama de estabilización antes de la unificación completa.

## Decisión confirmada y contrato técnico

Se confirma adoptar como línea principal la **Alternativa 2 (store único con Zustand para Home)**, por dar mayor control de sesión, evitar redescargas innecesarias y proteger rendimiento en TV.

### Tópicos confirmados

1. **Áreas independientes por dominio**  
   Cada dominio (`ads`, `vod`, `epg`, `catchup`) opera en su propio estado y ciclo de carga, sin acoplamiento funcional.

2. **Persistencia durante toda la sesión**  
   Los datos cargados se conservan durante la sesión activa de la app, aunque el usuario navegue entre diferentes áreas de Home.

3. **No redescargar si ya fue descargado**  
   Si un dominio está en `ready` y tiene datos, no se vuelve a descargar salvo invalidación explícita (`force`) o cambio real de contexto de sesión.

4. **Descarga completa (no fraccionada) cuando se ejecuta carga**  
   Cuando un dominio entra en carga inicial/forzada, debe descargar el dataset completo de ese dominio.

5. **Rendimiento como prioridad máxima**  
   Cualquier política de refresco o invalidación debe preservar fluidez y minimizar CPU/RAM/red en dispositivos TV.

### Nota de coherencia entre (3) y (4)

No hay contradicción si se define esta regla:
- **Regla base:** reutilizar datos ya cargados (sin redescarga).
- **Regla de excepción:** solo en eventos explícitos se ejecuta descarga completa (`force`, reinicio de sesión, invalidación mayor).

## Implementación aplicada en esta iteración

- `PreloadDataPage` pasa a usar el store unificado (`epg/vod/ads`) como fuente y disparador de carga.
- `VodPage` deja de depender de `useVodQuery` en Home y usa estado/carga de `usePreload`.
- `HomeShellContent` deja de depender de `useAdsQuery` en Home y usa estado/carga de `usePreload`.
- `preloadStore` ahora evita redescargar dominios en `ready` con data, salvo carga forzada (`force: true`).

Esta iteración deja la base operativa para persistencia por sesión y reutilización de información descargada sin recarga redundante en navegación interna.

